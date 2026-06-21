import piexif from 'piexifjs';

interface EXIFData {
  dateTaken: string; // ISO string or Date
  location: { lat: number; lng: number } | null;
}

// Convert ArrayBuffer to binary string (required by piexifjs)
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  // Chunk process to avoid "Maximum call stack size exceeded" on large files
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return binary;
}

// Convert binary string to ArrayBuffer
function binaryStringToArrayBuffer(binStr: string): ArrayBuffer {
  const buf = new ArrayBuffer(binStr.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = binStr.length; i < strLen; i++) {
    bufView[i] = binStr.charCodeAt(i);
  }
  return buf;
}

// Convert decimal degrees to EXIF GPS format (Degrees, Minutes, Seconds)
function decimalToExifGps(decimal: number): number[][] {
  const absVal = Math.abs(decimal);
  const degrees = Math.floor(absVal);
  const minutesVal = (absVal - degrees) * 60;
  const minutes = Math.floor(minutesVal);
  const seconds = Math.round((minutesVal - minutes) * 60 * 100);

  return [
    [degrees, 1],
    [minutes, 1],
    [seconds, 100],
  ];
}

/**
 * Repairs a JPEG buffer by injecting EXIF metadata (DateTimeOriginal and GPS)
 */
export function repairJpegExif(arrayBuffer: ArrayBuffer, data: EXIFData): ArrayBuffer {
  try {
    const binary = arrayBufferToBinaryString(arrayBuffer);
    
    // Load existing EXIF or create empty structure
    let exifObj: any = { '0th': {}, 'Exif': {}, 'GPS': {} };
    try {
      exifObj = piexif.load(binary);
    } catch {
      // If load fails, we will start with a fresh object
    }

    const date = new Date(data.dateTaken);
    if (!isNaN(date.getTime())) {
      // Format: YYYY:MM:DD HH:MM:SS
      const formattedDate = date
        .toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/, '')
        .replace(/-/g, ':');

      // Set date tags
      exifObj['0th'][piexif.ImageIFD.DateTime] = formattedDate;
      exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = formattedDate;
      exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = formattedDate;
    }

    // Set GPS tags if available
    if (data.location) {
      const lat = data.location.lat;
      const lng = data.location.lng;

      exifObj['GPS'][piexif.GPSIFD.GPSVersionID] = [2, 2, 0, 0];
      exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
      exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = decimalToExifGps(lat);
      exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
      exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = decimalToExifGps(lng);

      // Add GPS Date/Time stamp
      const gpsDate = date.toISOString().split('T')[0].replace(/-/g, ':');
      exifObj['GPS'][piexif.GPSIFD.GPSDateStamp] = gpsDate;

      const hour = date.getUTCHours();
      const min = date.getUTCMinutes();
      const sec = date.getUTCSeconds();
      exifObj['GPS'][piexif.GPSIFD.GPSTimeStamp] = [
        [hour, 1],
        [min, 1],
        [sec * 100, 100],
      ];
    }

    const exifBytes = piexif.dump(exifObj);
    const newBinary = piexif.insert(exifBytes, binary);
    
    return binaryStringToArrayBuffer(newBinary);
  } catch (error) {
    console.error('Error repairing EXIF:', error);
    return arrayBuffer; // Return original buffer if repair fails
  }
}
