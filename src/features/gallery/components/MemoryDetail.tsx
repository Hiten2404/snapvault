'use client';

import React, { useEffect, useState } from 'react';
import { SnapchatMemory } from '../../../types';
import { useMediaBlob, useMemories } from '../../../hooks/useMemories';
import { 
  X, 
  Download, 
  Heart, 
  Trash2, 
  Edit3, 
  MapPin, 
  Calendar, 
  Clock, 
  FileText, 
  Info,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Save
} from 'lucide-react';

interface MemoryDetailProps {
  memory: SnapchatMemory;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function MemoryDetail({ memory, onClose, onNext, onPrevious }: MemoryDetailProps) {
  const { toggleFavorite, deleteMemory, updateMetadata } = useMemories();
  const { data: mediaBlob, isLoading: loadingBlob } = useMediaBlob(memory.id);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form states
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  // Generate Object URL for raw media
  useEffect(() => {
    if (!mediaBlob) {
      setMediaUrl(null);
      return;
    }

    const url = URL.createObjectURL(mediaBlob);
    setMediaUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [mediaBlob, memory.id]);

  // Load current values when entering edit mode
  useEffect(() => {
    const d = new Date(memory.dateTaken);
    if (!isNaN(d.getTime())) {
      setEditDate(d.toISOString().split('T')[0]);
      setEditTime(d.toTimeString().split(' ')[0].substring(0, 5));
    }
    if (memory.location) {
      setEditLat(memory.location.lat.toString());
      setEditLng(memory.location.lng.toString());
    } else {
      setEditLat('');
      setEditLng('');
    }
  }, [memory, isEditing]);

  // Listen to keyboard arrow keys for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && onNext) onNext();
      else if (e.key === 'ArrowLeft' && onPrevious) onPrevious();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  // Toggle favorite
  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorite(memory.id);
  };

  // Delete memory
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this memory from your local archive? This cannot be undone.')) {
      await deleteMemory(memory.id);
      onClose();
    }
  };

  // Save metadata changes
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();

    let newDateString = memory.dateTaken;
    if (editDate && editTime) {
      const parsedDate = new Date(`${editDate}T${editTime}`);
      if (!isNaN(parsedDate.getTime())) {
        newDateString = parsedDate.toISOString();
      }
    }

    let location: { lat: number; lng: number } | null = null;
    if (editLat && editLng) {
      const lat = parseFloat(editLat);
      const lng = parseFloat(editLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        location = { lat, lng };
      }
    }

    await updateMetadata({
      id: memory.id,
      updates: {
        dateTaken: newDateString,
        location,
      },
    });

    setIsEditing(false);
  };

  // Single download trigger
  const handleDownload = () => {
    if (!mediaBlob) return;
    const url = URL.createObjectURL(mediaBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = memory.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parsedDate = new Date(memory.dateTaken);
  const formattedDate = !isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';
  const formattedTime = !isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 md:p-4 animate-fade-in">
      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-55 rounded-full bg-neutral-900/80 p-2.5 text-neutral-450 hover:bg-neutral-850 hover:text-white border border-neutral-900 cursor-pointer shadow"
      >
        <X className="h-5.5 w-5.5" />
      </button>

      {/* Main Container */}
      <div className="flex h-full w-full flex-col md:flex-row md:rounded-3xl border border-neutral-900 bg-neutral-950 overflow-hidden shadow-2xl">
        {/* Left Side: Media Viewer */}
        <div className="relative flex flex-1 items-center justify-center bg-neutral-990 p-4 min-h-[50vh] md:min-h-0 select-none group">
          {/* Navigation Arrows */}
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="absolute left-4 z-40 rounded-full bg-neutral-900/60 p-2.5 text-neutral-400 hover:bg-neutral-900 hover:text-white border border-neutral-800 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-4 z-40 rounded-full bg-neutral-900/60 p-2.5 text-neutral-450 hover:bg-neutral-900 hover:text-white border border-neutral-800 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Media Player */}
          {loadingBlob ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
              <span className="text-xs text-neutral-500">Loading original media...</span>
            </div>
          ) : mediaUrl ? (
            memory.type === 'photo' ? (
              <img
                src={mediaUrl}
                alt={memory.filename}
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-lg select-text"
              />
            ) : (
              <video
                src={mediaUrl}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-lg select-text"
              />
            )
          ) : (
            <div className="text-neutral-500 text-xs">Failed to load media binary.</div>
          )}
        </div>

        {/* Right Side: Metadata / Action Panel */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-neutral-900 bg-neutral-950 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-neutral-900/50">
              <Info className="h-4.5 w-4.5 text-neutral-400" />
              <span>Information</span>
            </h2>

            {isEditing ? (
              /* Edit Form */
              <form onSubmit={handleSaveMetadata} className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Date Taken</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-200 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Time Taken</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-200 focus:outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 34.05"
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. -118.24"
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded-xl border border-neutral-850 bg-neutral-900/30 hover:bg-neutral-900 py-2 text-xs font-semibold text-neutral-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 py-2 text-xs font-bold text-neutral-950 shadow transition-all active:scale-[0.98]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Metadata Detail Display */
              <div className="space-y-4">
                {/* Date / Time */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-400 shrink-0 border border-neutral-900">
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Date Taken</span>
                    <span className="text-xs font-semibold text-neutral-250 mt-0.5 block">{formattedDate}</span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formattedTime}
                    </span>
                  </div>
                </div>

                {/* Location MapPin */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-400 shrink-0 border border-neutral-900">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Location (GPS)</span>
                    <span className="text-xs font-semibold text-neutral-250 mt-0.5 block">
                      {memory.location 
                        ? `${memory.location.lat.toFixed(5)}, ${memory.location.lng.toFixed(5)}` 
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* File Properties */}
                <div className="flex gap-3">
                  <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-400 shrink-0 border border-neutral-900">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">File Details</span>
                    <span className="text-xs font-semibold text-neutral-250 mt-0.5 block truncate" title={memory.filename}>
                      {memory.filename}
                    </span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5 font-medium">
                      {formatBytes(memory.size)} • {memory.type === 'photo' ? 'Image' : 'Video'}
                    </span>
                    {memory.metadataRepaired && (
                      <span className="inline-block mt-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-extrabold text-emerald-450 uppercase tracking-wide">
                        EXIF Repaired
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="space-y-2 pt-6 mt-6 border-t border-neutral-900">
            {!isEditing && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    disabled={!mediaBlob}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-850 hover:bg-neutral-900 py-2.5 text-xs font-semibold text-neutral-300 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 text-neutral-400" />
                    <span>Download</span>
                  </button>

                  {/* Favorite */}
                  <button
                    onClick={handleFavorite}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                      memory.isFavorite
                        ? 'border-red-500/20 bg-red-500/10 text-red-400'
                        : 'border-neutral-850 hover:bg-neutral-900 text-neutral-300'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${memory.isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-400'}`} />
                    <span>Favorite</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Edit */}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-850 hover:bg-neutral-900 py-2.5 text-xs font-semibold text-neutral-300 transition-all active:scale-[0.98]"
                  >
                    <Edit3 className="h-4 w-4 text-neutral-400" />
                    <span>Edit Tags</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-850/30 hover:border-red-950 bg-neutral-900/10 hover:bg-red-500/10 hover:text-red-400 py-2.5 text-xs font-semibold text-neutral-450 transition-all active:scale-[0.98]"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
