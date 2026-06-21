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
    let retryCount = 0;

    const cleanUp = () => {
      URL.revokeObjectURL(url);
      video.src = '';
      video.load();
    };

    const captureFrame = () => {
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

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Check if the canvas is completely black
        const imgData = ctx.getImageData(0, 0, width, height).data;
        let isAllBlack = true;

        // Scan pixels at regular offsets (every 40th byte / 10th pixel) to check for color values
        for (let i = 0; i < imgData.length; i += 40) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          if (r > 15 || g > 15 || b > 15) {
            isAllBlack = false;
            break;
          }
        }

        // If it's black and we haven't hit the retry limit, wait or seek further
        if (isAllBlack && retryCount < 4 && video.duration > 0) {
          retryCount++;
          if (retryCount >= 2) {
            // Seek slightly further (e.g. 1.4s, 1.8s, 2.2s) in case of a fade-in intro
            const nextSeek = Math.min(1.0 + (retryCount * 0.4), video.duration);
            if (video.currentTime !== nextSeek) {
              isResolved = false; // Reset to allow the new seeked event to trigger captureFrame
              video.currentTime = nextSeek;
              return;
            }
          }
          setTimeout(captureFrame, 100);
          return;
        }

        isResolved = true;

        // Double draw workaround for browser rendering surface inconsistencies
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

    video.onloadedmetadata = () => {
      // Seek to 1 second (or 0 if video is shorter) to get a meaningful frame
      const seekTime = Math.min(1.0, video.duration || 0);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      if (isResolved) return;
      isResolved = true;
      // Use requestAnimationFrame to give the browser paint cycle time to decode/paint the frame
      requestAnimationFrame(() => {
        captureFrame();
      });
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
    }, 12000);
  });
}
