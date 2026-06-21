'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMemories } from '../../../hooks/useMemories';
import { SnapchatMemory } from '../../../types';
import ThumbnailImage from '../../../components/ThumbnailImage';
import JSZip from 'jszip';
import { getMediaBlob } from '../../../services/indexedDB';
import { repairJpegExif } from '../../metadata/utils/exifRepair';
import { 
  Search, 
  Filter, 
  Heart, 
  Grid3X3, 
  CalendarDays, 
  FolderHeart,
  CalendarDays as CalendarRange,
  ArrowLeft,
  Calendar,
  Loader2,
  CheckSquare,
  Check,
  X,
  Download
} from 'lucide-react';

interface MemoryGalleryProps {
  onSelectMemory: (memory: SnapchatMemory) => void;
  // Optional selected filters from parent (like when navigating from timeline)
  initialYear?: number | null;
  initialMonth?: string | null;
  // Selection states
  selectedMemoryIds?: Record<string, boolean>;
  setSelectedMemoryIds?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

type ViewMode = 'year' | 'month' | 'grid';

export default function MemoryGallery({ 
  onSelectMemory, 
  initialYear = null, 
  initialMonth = null,
  selectedMemoryIds = {},
  setSelectedMemoryIds
}: MemoryGalleryProps) {
  const { memories, isLoading, getFilteredMemories } = useMemories();

  // Selection Mode States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // Selected count
  const selectedCount = useMemo(() => {
    return Object.values(selectedMemoryIds).filter(Boolean).length;
  }, [selectedMemoryIds]);

  // Selection handlers
  const handleThumbnailClick = (memory: SnapchatMemory) => {
    if (isSelectMode && setSelectedMemoryIds) {
      setSelectedMemoryIds((prev) => ({
        ...prev,
        [memory.id]: !prev[memory.id],
      }));
    } else {
      onSelectMemory(memory);
    }
  };

  const handleSelectAll = () => {
    if (!setSelectedMemoryIds) return;
    const updated: Record<string, boolean> = {};
    finalMemories.forEach((m) => {
      updated[m.id] = true;
    });
    setSelectedMemoryIds((prev) => ({ ...prev, ...updated }));
  };

  const handleClearSelection = () => {
    if (!setSelectedMemoryIds) return;
    setSelectedMemoryIds({});
  };

  // Helper to retrieve and repair EXIF for JPEGs
  async function getExportableBlob(memory: SnapchatMemory): Promise<Blob> {
    const rawBlob = await getMediaBlob(memory.id);
    if (!rawBlob) {
      throw new Error(`Media content not found in database for ${memory.filename}`);
    }

    const ext = memory.filename.split('.').pop()?.toLowerCase();
    const isJpeg = ext === 'jpg' || ext === 'jpeg';

    if (isJpeg) {
      try {
        const buffer = await rawBlob.arrayBuffer();
        const repaired = repairJpegExif(buffer, {
          dateTaken: memory.dateTaken,
          location: memory.location,
        });
        return new Blob([repaired], { type: 'image/jpeg' });
      } catch (err) {
        console.warn('Failed to re-apply EXIF edits for export, exporting raw file:', err);
        return rawBlob;
      }
    }

    return rawBlob;
  }

  const handleExportSelected = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);
    setExportProgress('Preparing download...');
    const zip = new JSZip();

    try {
      let count = 0;
      const selectedMemories = memories.filter((m) => !!selectedMemoryIds[m.id]);
      const total = selectedMemories.length;

      for (const m of selectedMemories) {
        setExportProgress(`Fetching & repairing metadata: ${count + 1} of ${total}`);
        const exportBlob = await getExportableBlob(m);
        zip.file(m.filename, exportBlob);
        count++;
      }

      setExportProgress('Compressing ZIP archive...');
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setExportProgress(`Compressing: ${Math.round(metadata.percent)}%`);
      });

      setExportProgress('Saving download...');
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapvault-selected-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export selected memories.');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'photo' | 'video'>('all');
  
  // Navigation & Grouping States
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear);

  // Infinite Scroll chunk count for performance
  const [visibleItemsCount, setVisibleItemsCount] = useState(60);

  // Sync initial filters if they change from parent
  useEffect(() => {
    if (initialYear !== null) {
      setSelectedYear(initialYear);
      setViewMode('month');
    }
    if (initialMonth !== null) {
      // If a specific month is selected, we can directly show grid mode filtered
      setViewMode('grid');
    }
  }, [initialYear, initialMonth]);

  // Handle infinite scroll trigger
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      // When scrolled near bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < 400) {
        setVisibleItemsCount((prev) => prev + 60);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtered memory list
  const filteredMemories = useMemo(() => {
    return getFilteredMemories({ searchQuery, favoriteOnly, typeFilter });
  }, [memories, searchQuery, favoriteOnly, typeFilter, getFilteredMemories]);

  // Further filter by selected year in Year/Month drill-down
  const finalMemories = useMemo(() => {
    if (selectedYear === null) return filteredMemories;
    return filteredMemories.filter((m) => {
      const date = new Date(m.dateTaken);
      return !isNaN(date.getTime()) && date.getFullYear() === selectedYear;
    });
  }, [filteredMemories, selectedYear]);

  // Groupings helper
  const yearGroups = useMemo(() => {
    const groups: Record<number, { memories: SnapchatMemory[]; count: number }> = {};
    filteredMemories.forEach((m) => {
      const date = new Date(m.dateTaken);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (!groups[year]) {
          groups[year] = { memories: [], count: 0 };
        }
        groups[year].memories.push(m);
        groups[year].count++;
      }
    });

    return Object.entries(groups)
      .map(([year, info]) => ({
        year: parseInt(year),
        ...info,
      }))
      .sort((a, b) => b.year - a.year);
  }, [filteredMemories]);

  const monthGroups = useMemo(() => {
    const groups: Record<string, { memories: SnapchatMemory[]; label: string; year: number; monthVal: number }> = {};
    finalMemories.forEach((m) => {
      const date = new Date(m.dateTaken);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const monthVal = date.getMonth();
        const monthLabel = date.toLocaleString('default', { month: 'long' });
        const key = `${year}-${monthVal}`;
        if (!groups[key]) {
          groups[key] = {
            memories: [],
            label: `${monthLabel} ${year}`,
            year,
            monthVal,
          };
        }
        groups[key].memories.push(m);
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.monthVal - a.monthVal;
    });
  }, [finalMemories]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleItemsCount(60);
  }, [searchQuery, favoriteOnly, typeFilter, viewMode, selectedYear]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <p className="text-xs text-neutral-400">Loading your memories...</p>
        </div>
      </div>
    );
  }

  const handleYearClick = (year: number) => {
    setSelectedYear(year);
    setViewMode('month');
  };

  const clearYearSelection = () => {
    setSelectedYear(null);
    setViewMode('year');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            {selectedYear !== null && (
              <button 
                onClick={clearYearSelection}
                className="mr-1 rounded-lg p-1 text-neutral-400 hover:bg-neutral-900 hover:text-white"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            )}
            <span>
              {selectedYear !== null ? `${selectedYear} Memories` : 'All Memories'}
            </span>
          </h1>
          <p className="text-xs text-neutral-450 mt-1">
            Showing {filteredMemories.length} item{filteredMemories.length !== 1 ? 's' : ''} in total.
          </p>
        </div>

        {/* View Mode Switchers */}
        <div className="flex rounded-xl bg-neutral-900/60 p-1 border border-neutral-900 shrink-0 self-start md:self-auto">
          <button
            onClick={() => {
              setSelectedYear(null);
              setViewMode('year');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'year'
                ? 'bg-neutral-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Years</span>
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'month'
                ? 'bg-neutral-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Months</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'grid'
                ? 'bg-neutral-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>
        </div>

        {/* Selection mode toggle */}
        {setSelectedMemoryIds && (
          <button
            type="button"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedMemoryIds({});
              }
            }}
            className={`flex items-center gap-1.5 rounded-xl border py-1.5 px-3.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
              isSelectMode
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold'
                : 'border-neutral-900 bg-neutral-900/25 text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>{isSelectMode ? 'Cancel' : 'Select'}</span>
          </button>
        )}
      </div>

      {/* Filter Controllers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by date, year, month..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 py-2.5 pl-10 pr-4 text-xs text-neutral-200 placeholder-neutral-500 focus:border-yellow-500/30 focus:outline-none"
          />
        </div>

        {/* Media Type Filter */}
        <div className="flex rounded-xl bg-neutral-900/40 border border-neutral-900 p-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-450 hover:text-neutral-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('photo')}
            className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
              typeFilter === 'photo'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-450 hover:text-neutral-200'
            }`}
          >
            Photos
          </button>
          <button
            onClick={() => setTypeFilter('video')}
            className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
              typeFilter === 'video'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-450 hover:text-neutral-200'
            }`}
          >
            Videos
          </button>
        </div>

        {/* Favorite Filter Toggle */}
        <button
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
            favoriteOnly
              ? 'border-red-500/30 bg-red-500/10 text-red-400 font-bold'
              : 'border-neutral-900 bg-neutral-900/25 text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200'
          }`}
        >
          <Heart className={`h-4 w-4 ${favoriteOnly ? 'fill-red-500 text-red-500' : ''}`} />
          <span>Favorites Only</span>
        </button>
      </div>

      {/* Main Content Area */}
      {filteredMemories.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-900 bg-neutral-900/10 py-16 text-center">
          <FolderHeart className="h-10 w-10 text-neutral-600 mb-4" />
          <h3 className="text-sm font-bold text-neutral-400">No memories match your filters.</h3>
          <p className="text-xs text-neutral-650 mt-1 max-w-xs">
            Try adjusting your search queries or disabling the favorite filter.
          </p>
        </div>
      ) : viewMode === 'year' && selectedYear === null ? (
        /* Year View Mode */
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {yearGroups.map((group) => (
            <div
              key={group.year}
              onClick={() => handleYearClick(group.year)}
              className="group cursor-pointer rounded-2xl border border-neutral-900 bg-neutral-900/20 p-4 transition-all duration-200 hover:border-neutral-850 hover:bg-neutral-900/40 relative overflow-hidden"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-neutral-900 border border-neutral-850 mb-3 relative">
                {group.memories.length > 0 ? (
                  <ThumbnailImage
                    blob={group.memories[0].thumbnailBlob}
                    type={group.memories[0].type}
                    alt={`${group.year} memories thumbnail`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-700">
                    <Calendar className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent" />
                <span className="absolute bottom-3 left-3 text-lg font-black text-white">{group.year}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-semibold">{group.count} memories</span>
                <span className="text-[10px] text-yellow-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Month &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'month' ? (
        /* Month View Mode */
        <div className="space-y-8">
          {monthGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <h2 className="text-sm font-bold text-neutral-400 border-b border-neutral-900/60 pb-1.5 flex items-center justify-between">
                <span>{group.label}</span>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  {group.memories.length} item{group.memories.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {group.memories.slice(0, visibleItemsCount).map((memory) => {
                  const isSelected = !!selectedMemoryIds[memory.id];
                  return (
                    <div
                      key={memory.id}
                      onClick={() => handleThumbnailClick(memory)}
                      className={`aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-900 border transition-all relative shadow-sm ${
                        isSelectMode && isSelected
                          ? 'border-yellow-500 shadow-md shadow-yellow-500/10'
                          : 'border-neutral-900/80 hover:border-yellow-500/40'
                      }`}
                    >
                      <ThumbnailImage
                        blob={memory.thumbnailBlob}
                        type={memory.type}
                        alt={memory.filename}
                      />
                      
                      {/* Checkbox overlay in Select Mode */}
                      {isSelectMode && (
                        <div className={`absolute top-1.5 left-1.5 flex h-4.5 w-4.5 items-center justify-center rounded border transition-all ${
                          isSelected ? 'bg-yellow-500 border-yellow-500 text-neutral-950' : 'bg-neutral-950/80 border-neutral-700'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      )}

                      {memory.isFavorite && !isSelectMode && (
                        <div className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-md bg-neutral-950/85 backdrop-blur-sm border border-neutral-850 text-red-500 shadow-sm">
                          <Heart className="h-2.5 w-2.5 fill-current" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Simple Chronological Grid View Mode */
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {finalMemories.slice(0, visibleItemsCount).map((memory) => {
              const isSelected = !!selectedMemoryIds[memory.id];
              return (
                <div
                  key={memory.id}
                  onClick={() => handleThumbnailClick(memory)}
                  className={`aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-900 border transition-all relative shadow-sm ${
                    isSelectMode && isSelected
                      ? 'border-yellow-500 shadow-md shadow-yellow-500/10'
                      : 'border-neutral-900/80 hover:border-yellow-500/40'
                  }`}
                >
                  <ThumbnailImage
                    blob={memory.thumbnailBlob}
                    type={memory.type}
                    alt={memory.filename}
                  />

                  {/* Checkbox overlay in Select Mode */}
                  {isSelectMode && (
                    <div className={`absolute top-1.5 left-1.5 flex h-4.5 w-4.5 items-center justify-center rounded border transition-all ${
                      isSelected ? 'bg-yellow-500 border-yellow-500 text-neutral-950' : 'bg-neutral-950/80 border-neutral-700'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  )}

                  {memory.isFavorite && !isSelectMode && (
                    <div className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-md bg-neutral-950/85 backdrop-blur-sm border border-neutral-850 text-red-500 shadow-sm">
                      <Heart className="h-2.5 w-2.5 fill-current" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {visibleItemsCount < finalMemories.length && (
            <div className="flex justify-center pt-4">
              <button 
                onClick={() => setVisibleItemsCount((prev) => prev + 60)}
                className="rounded-xl border border-neutral-900 bg-neutral-900/40 hover:bg-neutral-900 py-2 px-4 text-xs font-semibold text-neutral-450 hover:text-white"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Sticky Bottom Selection Bar & Zip Compression Modal Overlay wrapped in Portal to bypass parent CSS transform */}
      {typeof window !== 'undefined' && createPortal(
        <>
          {isSelectMode && setSelectedMemoryIds && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-950/95 border border-neutral-900 rounded-2xl py-3 px-5 shadow-2xl backdrop-blur-md flex items-center gap-3.5 animate-fade-in whitespace-nowrap">
              <span className="text-xs font-semibold text-neutral-300">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="h-4 w-px bg-neutral-900" />
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-lg bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 py-1.5 px-3 text-[10px] font-bold text-neutral-350 cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="rounded-lg bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 py-1.5 px-3 text-[10px] font-bold text-neutral-350 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleExportSelected}
                disabled={selectedCount === 0 || isExporting}
                className="rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-900 disabled:text-neutral-600 py-1.5 px-3.5 text-xs font-bold text-neutral-950 flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none shadow-md shadow-yellow-500/5"
              >
                {isExporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span>Download ZIP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedMemoryIds({});
                }}
                className="rounded-lg bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 p-1.5 text-neutral-450 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isExporting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl glass-card flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Generating ZIP File...</h4>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
                    {exportProgress}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
