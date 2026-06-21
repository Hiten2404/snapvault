/**
 * Generates a thumbnail for an image Blob.
 */
export function generateImageThumbnail(imageBlob: Blob, maxDimension = 300): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        },
        'image/jpeg',
        0.8 // Quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Generates a thumbnail for a video Blob by seeking to 1.0s and drawing the frame.
 */
export function generateVideoThumbnail(videoBlob: Blob, maxDimension = 300): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoBlob);

    let isResolved = false;

    const cleanUp = () => {
      URL.revokeObjectURL(url);
      video.src = '';
      video.load();
    };

    video.onloadedmetadata = () => {
      // Seek to 1 second (or 0 if video is shorter) to get a meaningful frame (not black)
      const seekTime = Math.min(1.0, video.duration || 0);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      if (isResolved) return;
      isResolved = true;

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context'));
          cleanUp();
          return;
        }

        let width = video.videoWidth || 300;
        let height = video.videoHeight || 300;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanUp();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Video canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };

    video.onerror = (err) => {
      if (isResolved) return;
      isResolved = true;
      cleanUp();
      reject(err);
    };

    // Set src and trigger load
    video.src = url;
    video.load();

    // Fallback timeout in case seeked doesn't fire
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanUp();
        reject(new Error('Video thumbnail generation timed out'));
      }
    }, 10000);
  });
}
