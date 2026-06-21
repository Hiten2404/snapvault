export interface SnapchatMemory {
  id: string; // Typically the SHA-256 hash or combined unique key
  filename: string;
  type: 'photo' | 'video';
  dateTaken: string; // ISO String: YYYY-MM-DDTHH:mm:ssZ
  location: {
    lat: number;
    lng: number;
  } | null;
  mediaBlob: Blob;
  thumbnailBlob: Blob | null;
  isFavorite: boolean;
  sha256: string;
  size: number;
  resolution: string | null; // e.g., "1080x1920"
  originalFilename: string;
  isCombined: boolean;
  metadataRepaired: boolean;
}

export interface DuplicateGroup {
  id: string;
  sha256: string;
  memories: SnapchatMemory[];
}

export interface ArchiveStats {
  totalMemories: number;
  totalPhotos: number;
  totalVideos: number;
  oldestMemory: string | null;
  newestMemory: string | null;
  yearsCovered: number[];
  gpsTaggedMemories: number;
  duplicateCount: number;
  storageUsedBytes: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  importPreference: 'originals' | 'combined' | 'both';
  autoRepairMetadata: boolean;
  saveGpsIfAvailable: boolean;
}

export type ImportStep =
  | 'idle'
  | 'reading_zip'
  | 'parsing_metadata'
  | 'matching_media'
  | 'repairing_metadata'
  | 'generating_thumbnails'
  | 'complete'
  | 'error';

export interface ImportProgress {
  step: ImportStep;
  percentage: number;
  statusText: string;
  errorText?: string;
  stats?: {
    totalFiles: number;
    matchedCount: number;
    repairedCount: number;
    duplicatesCount: number;
  };
}
