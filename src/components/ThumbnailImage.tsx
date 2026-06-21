'use client';

import React, { useEffect, useState } from 'react';
import { ImageIcon, Video } from 'lucide-react';

interface ThumbnailImageProps {
  blob: Blob | null;
  type: 'photo' | 'video';
  alt: string;
  className?: string;
}

export default function ThumbnailImage({ blob, type, alt, className = '' }: ThumbnailImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-neutral-900 text-neutral-600 ${className}`}>
        {type === 'video' ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group overflow-hidden">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${className}`}
      />
      {type === 'video' && (
        <div className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-md bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 text-[10px] text-white">
          <Video className="h-3 w-3 text-neutral-300" />
        </div>
      )}
    </div>
  );
}
