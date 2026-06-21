import JSZip from 'jszip';
import { SnapchatMemory, ImportProgress, UserSettings } from '../../../types';
import { saveMemoriesBulk } from '../../../services/indexedDB';
import { repairJpegExif } from '../../metadata/utils/exifRepair';
import { generateImageThumbnail, generateVideoThumbnail } from '../../../utils/thumbnail';

interface ParsedHtmlMemory {
  dateStr: string;
  typeStr: 'PHOTO' | 'VIDEO' | string;
  location: { lat: number; lng: number } | null;
  downloadUrl: string;
}

// SHA-256 helper
async function calculateSHA256(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Parse location string to lat/lng
function parseLocation(text: string): { lat: number; lng: number } | null {
  if (!text || text.toUpperCase().includes('N/A')) return null;
  // Look for coordinates format: 34.052234, -118.243684
  const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const match = text.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

// Parse memories_history.html content
function parseHtmlMetadata(htmlContent: string): ParsedHtmlMemory[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const memories: ParsedHtmlMemory[] = [];

  // Try finding rows in table first
  const rows = doc.querySelectorAll('table tbody tr');
  if (rows.length > 0) {
    // Determine headers
    const headers = Array.from(doc.querySelectorAll('table thead th')).map(th => th.textContent?.trim() || '');
    let dateIdx = 0;
    let typeIdx = 1;
    let locationIdx = 2;
    let linkIdx = 3;

    headers.forEach((header, idx) => {
      const h = header.toLowerCase();
      if (h.includes('date')) dateIdx = idx;
      else if (h.includes('type')) typeIdx = idx;
      else if (h.includes('location')) locationIdx = idx;
      else if (h.includes('link') || h.includes('download')) linkIdx = idx;
    });

    rows.forEach((row) => {
      const cols = row.querySelectorAll('td');
      if (cols.length >= 4) {
        const dateStr = cols[dateIdx]?.textContent?.trim() || '';
        const typeStr = cols[typeIdx]?.textContent?.trim() || 'PHOTO';
        const locationText = cols[locationIdx]?.textContent?.trim() || '';
        
        // Find anchor tag for download URL
        const anchor = cols[linkIdx]?.querySelector('a');
        const downloadUrl = anchor ? anchor.getAttribute('href') || '' : '';

        // Try extracting GPS from anchor's href or td content
        let location = parseLocation(locationText);
        if (!location && anchor) {
          location = parseLocation(anchor.getAttribute('href') || '');
        }

        if (dateStr) {
          memories.push({
            dateStr,
            typeStr,
            location,
            downloadUrl,
          });
        }
      }
    });
  } else {
    // Alternate formatting - search list items or specific structure
    const listItems = doc.querySelectorAll('li');
    listItems.forEach((li) => {
      const dateStr = li.querySelector('.date, .timestamp')?.textContent?.trim() || li.textContent?.match(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\sUTC/)?.[0] || '';
      const typeStr = li.textContent?.toUpperCase().includes('VIDEO') ? 'VIDEO' : 'PHOTO';
      const anchor = li.querySelector('a');
      const downloadUrl = anchor ? anchor.getAttribute('href') || '' : '';
      const location = parseLocation(li.textContent || '');

      if (dateStr) {
        memories.push({
          dateStr,
          typeStr,
          location,
          downloadUrl,
        });
      }
    });
  }

  // If nothing is parsed, check if it's a JSON export under .html?
  // Sometimes, Snapchat downloads are JSON in different folders, but let's assume memories_history.html is the standard.
  return memories;
}

// Clean filename to match keys
function getBaseName(filepath: string): string {
  const parts = filepath.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/-main\.[^.]+$/, '').replace(/-combined\.[^.]+$/, '').split('.')[0];
}

export async function processSnapchatZip(
  zipData: File | ArrayBuffer,
  settings: UserSettings,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  try {
    onProgress({
      step: 'reading_zip',
      percentage: 10,
      statusText: 'Reading Snapchat Export ZIP File...',
    });

    const arrayBuffer = zipData instanceof File ? await zipData.arrayBuffer() : zipData;
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find memories_history.html
    let htmlFileKey = '';
    zip.forEach((relativePath) => {
      if (relativePath.endsWith('memories_history.html')) {
        htmlFileKey = relativePath;
      }
    });

    if (!htmlFileKey) {
      // Look for a JSON memories file as fallback or fail
      let hasJsonFallback = false;
      zip.forEach((relativePath) => {
        if (relativePath.endsWith('memories_history.json')) {
          hasJsonFallback = true;
        }
      });

      if (!hasJsonFallback) {
        throw new Error('Could not find memories_history.html or memories_history.json in the ZIP file. Please ensure this is a valid Snapchat Data Export.');
      }
    }

    onProgress({
      step: 'parsing_metadata',
      percentage: 25,
      statusText: 'Parsing Snapchat memory metadata...',
    });

    let htmlMemories: ParsedHtmlMemory[] = [];
    if (htmlFileKey) {
      const htmlContent = await zip.file(htmlFileKey)!.async('text');
      htmlMemories = parseHtmlMetadata(htmlContent);
    } else {
      // Fallback JSON parser if html is missing but json exists
      let jsonFileKey = '';
      zip.forEach((path) => {
        if (path.endsWith('memories_history.json')) jsonFileKey = path;
      });
      const jsonContent = await zip.file(jsonFileKey)!.async('text');
      const jsonData = JSON.parse(jsonContent);
      const list = jsonData.SavedMemories || jsonData['Saved Memories'] || [];
      htmlMemories = list.map((item: any) => ({
        dateStr: item.Date || item.Timestamp || '',
        typeStr: item['Media Type'] || item.MediaType || 'PHOTO',
        location: item.Location ? { lat: item.Location.Latitude, lng: item.Location.Longitude } : null,
        downloadUrl: item['Download Link'] || item.DownloadLink || '',
      }));
    }

    onProgress({
      step: 'matching_media',
      percentage: 40,
      statusText: 'Locating and matching media files in ZIP...',
    });

    // Get all media files from ZIP
    interface ZipMediaFile {
      path: string;
      file: JSZip.JSZipObject;
      baseName: string;
      extension: string;
      isCombined: boolean;
    }
    const mediaFiles: ZipMediaFile[] = [];
    
    zip.forEach((path, file) => {
      const lowerPath = path.toLowerCase();
      // Skip folders and only look for common images/videos in memories directory or root
      if (!file.dir && (lowerPath.includes('memories/') || lowerPath.includes('memory')) &&
          (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') ||
           lowerPath.endsWith('.mp4') || lowerPath.endsWith('.mov'))) {
        
        const ext = lowerPath.split('.').pop() || '';
        const isCombined = lowerPath.includes('-combined');
        mediaFiles.push({
          path,
          file,
          baseName: getBaseName(path),
          extension: ext,
          isCombined,
        });
      }
    });

    if (mediaFiles.length === 0) {
      throw new Error('No media files (JPG, PNG, MP4, MOV) found in the ZIP under memories/ or related folders.');
    }

    // Filters based on User Import Preferences (Original vs Combined Handling)
    // Preference: 'originals', 'combined', 'both'
    const preference = settings.importPreference;
    let filteredMediaFiles: ZipMediaFile[] = [];

    if (preference === 'both') {
      filteredMediaFiles = mediaFiles;
    } else {
      // Group by base name
      const grouped: Record<string, ZipMediaFile[]> = {};
      mediaFiles.forEach((f) => {
        if (!grouped[f.baseName]) grouped[f.baseName] = [];
        grouped[f.baseName].push(f);
      });

      Object.values(grouped).forEach((group) => {
        if (group.length === 1) {
          filteredMediaFiles.push(group[0]);
        } else {
          // Multiple files for same memory (likely -main and -combined)
          const mainFile = group.find((f) => !f.isCombined);
          const combinedFile = group.find((f) => f.isCombined);

          if (preference === 'originals') {
            if (mainFile) filteredMediaFiles.push(mainFile);
            else if (combinedFile) filteredMediaFiles.push(combinedFile);
          } else if (preference === 'combined') {
            if (combinedFile) filteredMediaFiles.push(combinedFile);
            else if (mainFile) filteredMediaFiles.push(mainFile);
          }
        }
      });
    }

    // Match metadata to media files
    // Let's sort metadata by date, and try matching
    const sortedMetadata = [...htmlMemories].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

    // We can match using filenames containing dates (e.g. 2021-08-21_17-34-12) or closest dates,
    // or filenames mapping to URL parameters.
    const memoriesToStore: SnapchatMemory[] = [];
    const totalToProcess = filteredMediaFiles.length;

    let processedCount = 0;
    let repairedCount = 0;
    let duplicatesCount = 0;

    onProgress({
      step: 'repairing_metadata',
      percentage: 50,
      statusText: `Repairing metadata & generating thumbnails (0/${totalToProcess})...`,
      stats: {
        totalFiles: totalToProcess,
        matchedCount: 0,
        repairedCount: 0,
        duplicatesCount: 0,
      },
    });

    // Chunk size for bulk saves and yielding to browser main thread
    const batchSize = 10;
    let currentBatch: SnapchatMemory[] = [];

    for (const mediaFile of filteredMediaFiles) {
      // Read binary
      const arrayBuffer = await mediaFile.file.async('arraybuffer');
      const sha256 = await calculateSHA256(arrayBuffer);
      
      // Attempt to match metadata
      // 1. Check if download url contains the baseName of the file
      let matchedMeta = sortedMetadata.find((meta) => {
        const decodedUrl = decodeURIComponent(meta.downloadUrl);
        return decodedUrl.includes(mediaFile.baseName);
      });

      // 2. If not matched, try timestamp matching if baseName contains date info
      if (!matchedMeta) {
        // Filenames often contain dates like: 2021-08-21_17-34-12
        const dateMatch = mediaFile.baseName.match(/(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/);
        if (dateMatch) {
          const fileDateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}Z`;
          const fileTime = new Date(fileDateStr).getTime();
          if (!isNaN(fileTime)) {
            // Find closest metadata timestamp within 10 seconds
            matchedMeta = sortedMetadata.find((meta) => {
              const metaTime = new Date(meta.dateStr).getTime();
              return Math.abs(metaTime - fileTime) <= 10000;
            });
          }
        }
      }

      // 3. Fallback: match by index if names and dates don't align, or use file's own zip modification time
      let dateTaken = new Date(mediaFile.file.date).toISOString();
      let location: { lat: number; lng: number } | null = null;
      let matched = false;

      if (matchedMeta) {
        dateTaken = new Date(matchedMeta.dateStr).toISOString();
        location = matchedMeta.location;
        matched = true;
      }

      const isPhoto = ['jpg', 'jpeg', 'png'].includes(mediaFile.extension.toLowerCase());
      const type: 'photo' | 'video' = isPhoto ? 'photo' : 'video';

      // Repair Metadata
      let finalBuffer = arrayBuffer;
      let metadataRepaired = false;

      if (isPhoto && settings.autoRepairMetadata && (mediaFile.extension.toLowerCase() === 'jpg' || mediaFile.extension.toLowerCase() === 'jpeg')) {
        finalBuffer = repairJpegExif(arrayBuffer, {
          dateTaken,
          location: settings.saveGpsIfAvailable ? location : null,
        });
        metadataRepaired = true;
        repairedCount++;
      }

      const mediaBlob = new Blob([finalBuffer], {
        type: type === 'photo' ? `image/${mediaFile.extension}` : `video/${mediaFile.extension}`,
      });

      // Generate thumbnail
      let thumbnailBlob: Blob | null = null;
      try {
        if (type === 'photo') {
          thumbnailBlob = await generateImageThumbnail(mediaBlob);
        } else {
          thumbnailBlob = await generateVideoThumbnail(mediaBlob);
        }
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail for:', mediaFile.path, thumbError);
        // Fallback to null thumbnail, browser will load full media
      }

      // File Info
      const filename = mediaFile.path.split('/').pop() || mediaFile.path;

      // Unique ID is a combination of hash + preference indicator so originals and combined both store separately if needed
      const id = `${sha256}_${mediaFile.isCombined ? 'combined' : 'main'}`;

      const snapMemory: SnapchatMemory = {
        id,
        filename,
        type,
        dateTaken,
        location,
        mediaBlob,
        thumbnailBlob,
        isFavorite: false,
        sha256,
        size: mediaBlob.size,
        resolution: null, // Can be loaded on display dynamically or omitted
        originalFilename: mediaFile.path,
        isCombined: mediaFile.isCombined,
        metadataRepaired,
      };

      currentBatch.push(snapMemory);
      memoriesToStore.push(snapMemory);
      processedCount++;

      // Progress Update
      if (processedCount % batchSize === 0 || processedCount === totalToProcess) {
        onProgress({
          step: 'repairing_metadata',
          percentage: 50 + Math.round((processedCount / totalToProcess) * 45),
          statusText: `Repairing metadata & generating thumbnails (${processedCount}/${totalToProcess})...`,
          stats: {
            totalFiles: totalToProcess,
            matchedCount: memoriesToStore.filter((m) => m.metadataRepaired).length,
            repairedCount: repairedCount,
            duplicatesCount: duplicatesCount,
          },
        });

        // Save batch to database to free up browser memory
        await saveMemoriesBulk(currentBatch);
        currentBatch = [];
      }
    }

    onProgress({
      step: 'complete',
      percentage: 100,
      statusText: `Snapchat export successfully processed. Imported ${processedCount} memories.`,
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    onProgress({
      step: 'error',
      percentage: 100,
      statusText: 'Import failed.',
      errorText: error.message || 'An unknown error occurred during import.',
    });
  }
}

export async function processSnapchatFolder(
  files: File[],
  settings: UserSettings,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  try {
    onProgress({
      step: 'reading_zip',
      percentage: 10,
      statusText: 'Reading selected folder contents...',
    });

    // Find memories_history.html or .json
    const htmlFile = files.find((f) => f.name.endsWith('memories_history.html'));
    const jsonFile = files.find((f) => f.name.endsWith('memories_history.json'));

    if (!htmlFile && !jsonFile) {
      throw new Error(
        'Could not find memories_history.html or memories_history.json in the selected folder. Please ensure this is the unzipped Snapchat Data Export directory.'
      );
    }

    onProgress({
      step: 'parsing_metadata',
      percentage: 25,
      statusText: 'Parsing Snapchat memory metadata...',
    });

    let htmlMemories: ParsedHtmlMemory[] = [];
    if (htmlFile) {
      const htmlContent = await htmlFile.text();
      htmlMemories = parseHtmlMetadata(htmlContent);
    } else if (jsonFile) {
      const jsonContent = await jsonFile.text();
      const jsonData = JSON.parse(jsonContent);
      const list = jsonData.SavedMemories || jsonData['Saved Memories'] || [];
      htmlMemories = list.map((item: any) => ({
        dateStr: item.Date || item.Timestamp || '',
        typeStr: item['Media Type'] || item.MediaType || 'PHOTO',
        location: item.Location ? { lat: item.Location.Latitude, lng: item.Location.Longitude } : null,
        downloadUrl: item['Download Link'] || item.DownloadLink || '',
      }));
    }

    onProgress({
      step: 'matching_media',
      percentage: 40,
      statusText: 'Locating and matching media files in folder...',
    });

    // Get all media files from folder list
    interface FolderMediaFile {
      file: File;
      baseName: string;
      extension: string;
      isCombined: boolean;
    }
    const mediaFiles: FolderMediaFile[] = [];

    files.forEach((file) => {
      const lowerName = file.name.toLowerCase();
      const lowerPath = file.webkitRelativePath.toLowerCase();
      
      // Filter for files in memories folder or containing 'memories' in path, and check extensions
      if ((lowerPath.includes('memories/') || lowerPath.includes('memory') || lowerName.includes('memory')) &&
          (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') ||
           lowerName.endsWith('.mp4') || lowerName.endsWith('.mov'))) {
        
        const ext = lowerName.split('.').pop() || '';
        const isCombined = lowerName.includes('-combined');
        mediaFiles.push({
          file,
          baseName: getBaseName(file.name),
          extension: ext,
          isCombined,
        });
      }
    });

    if (mediaFiles.length === 0) {
      throw new Error('No media files (JPG, PNG, MP4, MOV) found in the folder under memories/ or related paths.');
    }

    // Filter by preferences
    const preference = settings.importPreference;
    let filteredMediaFiles: FolderMediaFile[] = [];

    if (preference === 'both') {
      filteredMediaFiles = mediaFiles;
    } else {
      const grouped: Record<string, FolderMediaFile[]> = {};
      mediaFiles.forEach((f) => {
        if (!grouped[f.baseName]) grouped[f.baseName] = [];
        grouped[f.baseName].push(f);
      });

      Object.values(grouped).forEach((group) => {
        if (group.length === 1) {
          filteredMediaFiles.push(group[0]);
        } else {
          const mainFile = group.find((f) => !f.isCombined);
          const combinedFile = group.find((f) => f.isCombined);

          if (preference === 'originals') {
            if (mainFile) filteredMediaFiles.push(mainFile);
            else if (combinedFile) filteredMediaFiles.push(combinedFile);
          } else if (preference === 'combined') {
            if (combinedFile) filteredMediaFiles.push(combinedFile);
            else if (mainFile) filteredMediaFiles.push(mainFile);
          }
        }
      });
    }

    const sortedMetadata = [...htmlMemories].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );

    const memoriesToStore: SnapchatMemory[] = [];
    const totalToProcess = filteredMediaFiles.length;

    let processedCount = 0;
    let repairedCount = 0;
    let duplicatesCount = 0;

    onProgress({
      step: 'repairing_metadata',
      percentage: 50,
      statusText: `Repairing metadata & generating thumbnails (0/${totalToProcess})...`,
      stats: {
        totalFiles: totalToProcess,
        matchedCount: 0,
        repairedCount: 0,
        duplicatesCount: 0,
      },
    });

    const batchSize = 10;
    let currentBatch: SnapchatMemory[] = [];

    for (const mediaFile of filteredMediaFiles) {
      // Read binary
      const arrayBuffer = await mediaFile.file.arrayBuffer();
      const sha256 = await calculateSHA256(arrayBuffer);

      // Match metadata
      let matchedMeta = sortedMetadata.find((meta) => {
        const decodedUrl = decodeURIComponent(meta.downloadUrl);
        return decodedUrl.includes(mediaFile.baseName);
      });

      if (!matchedMeta) {
        const dateMatch = mediaFile.baseName.match(
          /(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/
        );
        if (dateMatch) {
          const fileDateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}Z`;
          const fileTime = new Date(fileDateStr).getTime();
          if (!isNaN(fileTime)) {
            matchedMeta = sortedMetadata.find((meta) => {
              const metaTime = new Date(meta.dateStr).getTime();
              return Math.abs(metaTime - fileTime) <= 10000;
            });
          }
        }
      }

      let dateTaken = new Date(mediaFile.file.lastModified).toISOString();
      let location: { lat: number; lng: number } | null = null;

      if (matchedMeta) {
        dateTaken = new Date(matchedMeta.dateStr).toISOString();
        location = matchedMeta.location;
      }

      const isPhoto = ['jpg', 'jpeg', 'png'].includes(mediaFile.extension.toLowerCase());
      const type: 'photo' | 'video' = isPhoto ? 'photo' : 'video';

      let finalBuffer = arrayBuffer;
      let metadataRepaired = false;

      if (
        isPhoto &&
        settings.autoRepairMetadata &&
        (mediaFile.extension.toLowerCase() === 'jpg' || mediaFile.extension.toLowerCase() === 'jpeg')
      ) {
        finalBuffer = repairJpegExif(arrayBuffer, {
          dateTaken,
          location: settings.saveGpsIfAvailable ? location : null,
        });
        metadataRepaired = true;
        repairedCount++;
      }

      const mediaBlob = new Blob([finalBuffer], {
        type: type === 'photo' ? `image/${mediaFile.extension}` : `video/${mediaFile.extension}`,
      });

      let thumbnailBlob: Blob | null = null;
      try {
        if (type === 'photo') {
          thumbnailBlob = await generateImageThumbnail(mediaBlob);
        } else {
          thumbnailBlob = await generateVideoThumbnail(mediaBlob);
        }
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail for:', mediaFile.file.name, thumbError);
      }

      const filename = mediaFile.file.name;
      const id = `${sha256}_${mediaFile.isCombined ? 'combined' : 'main'}`;

      const snapMemory: SnapchatMemory = {
        id,
        filename,
        type,
        dateTaken,
        location,
        mediaBlob,
        thumbnailBlob,
        isFavorite: false,
        sha256,
        size: mediaBlob.size,
        resolution: null,
        originalFilename: mediaFile.file.name,
        isCombined: mediaFile.isCombined,
        metadataRepaired,
      };

      currentBatch.push(snapMemory);
      memoriesToStore.push(snapMemory);
      processedCount++;

      if (processedCount % batchSize === 0 || processedCount === totalToProcess) {
        onProgress({
          step: 'repairing_metadata',
          percentage: 50 + Math.round((processedCount / totalToProcess) * 45),
          statusText: `Repairing metadata & generating thumbnails (${processedCount}/${totalToProcess})...`,
          stats: {
            totalFiles: totalToProcess,
            matchedCount: memoriesToStore.filter((m) => m.metadataRepaired).length,
            repairedCount: repairedCount,
            duplicatesCount: duplicatesCount,
          },
        });

        await saveMemoriesBulk(currentBatch);
        currentBatch = [];
      }
    }

    onProgress({
      step: 'complete',
      percentage: 100,
      statusText: `Snapchat export successfully processed. Imported ${processedCount} memories from folder.`,
    });
  } catch (error: any) {
    console.error('Folder import failed:', error);
    onProgress({
      step: 'error',
      percentage: 100,
      statusText: 'Import failed.',
      errorText: error.message || 'An unknown error occurred during folder import.',
    });
  }
}
