'use client';

import { useArchiveStats } from '../../../hooks/useMemories';
import { 
  Image as ImageIcon, 
  Video, 
  MapPin, 
  Copy, 
  HardDrive, 
  Calendar,
  Sparkles,
  UploadCloud,
  ArrowRight,
  ShieldCheck,
  CalendarRange
} from 'lucide-react';

interface DashboardProps {
  onTriggerImport: () => void;
  onNavigateToTab: (tab: 'memories' | 'duplicates' | 'settings') => void;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Dashboard({ onTriggerImport, onNavigateToTab }: DashboardProps) {
  const { data: stats, isLoading, isError } = useArchiveStats();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          <p className="text-xs text-neutral-400">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">Failed to load statistics.</p>
      </div>
    );
  }

  const isEmpty = stats.totalMemories === 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Overview of your local Snapchat Memories archive.
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={onTriggerImport}
            className="flex items-center justify-center gap-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-semibold px-4 py-2.5 text-xs shadow-md transition-all active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Import New ZIP</span>
          </button>
        )}
      </div>

      {isEmpty ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/10 p-12 text-center max-w-2xl mx-auto mt-8 relative overflow-hidden glass-card">
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/5 blur-[80px] pointer-events-none" />
          
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-500/10 mb-6 border border-yellow-500/20">
            <UploadCloud className="h-7 w-7 text-yellow-500" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">No Memories Imported Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md mb-8">
            Upload your Snapchat Data Export ZIP file. SnapVault will process it completely in your browser, extract metadata, repair EXIF headers, and build a local timeline.
          </p>

          <div className="space-y-4 w-full max-w-sm">
            <button
              onClick={onTriggerImport}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-neutral-950 font-bold py-3 px-6 text-sm shadow-lg shadow-yellow-500/10 transition-all active:scale-[0.98]"
            >
              <span>Process Snapchat ZIP</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            
            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>100% Client-side. No data leaves your machine.</span>
            </div>
          </div>
        </div>
      ) : (
        /* Stats Dashboard Grid */
        <div className="space-y-8">
          {/* Top Banner Overview */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-neutral-900/50 border border-yellow-500/20 p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/20 border border-yellow-500/30">
                <Sparkles className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
                  Your Archive is Ready!
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                  Successfully index-linked {stats.totalMemories} Snapchat memories. All images have repaired EXIF headers. Feel free to browse, filter, or download the results.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => onNavigateToTab('memories')}
              className="w-full md:w-auto flex items-center justify-center gap-2 shrink-0 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <span>Explore Gallery</span>
              <ArrowRight className="h-4 w-4 text-yellow-500" />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Total Memories */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Total Memories</span>
                <span className="text-2xl font-extrabold text-white">{stats.totalMemories}</span>
              </div>
            </div>

            {/* Storage Used */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Storage Saved Local</span>
                <span className="text-2xl font-extrabold text-white">{formatBytes(stats.storageUsedBytes)}</span>
              </div>
            </div>

            {/* GPS Tagged */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-yellow-500/10 transition-colors" onClick={() => onNavigateToTab('memories')}>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <MapPin className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">GPS Tagged Memories</span>
                <span className="text-2xl font-extrabold text-white flex items-baseline gap-1.5">
                  {stats.gpsTaggedMemories}
                  <span className="text-xs text-neutral-500 font-medium">
                    ({stats.totalMemories > 0 ? Math.round((stats.gpsTaggedMemories / stats.totalMemories) * 100) : 0}%)
                  </span>
                </span>
              </div>
            </div>

            {/* Duplicate Files */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-yellow-500/10 transition-colors" onClick={() => onNavigateToTab('duplicates')}>
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <Copy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Duplicates Found</span>
                <span className="text-2xl font-extrabold text-white">{stats.duplicateCount}</span>
              </div>
            </div>

            {/* Photos & Videos breakdown */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <Video className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Media Breakdown</span>
                <span className="text-sm font-semibold text-neutral-300">
                  {stats.totalPhotos} Photos / {stats.totalVideos} Videos
                </span>
              </div>
            </div>

            {/* Years Covered */}
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <CalendarRange className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Years Covered</span>
                <span className="text-sm font-bold text-neutral-300">
                  {stats.yearsCovered.length > 0 ? `${stats.yearsCovered[stats.yearsCovered.length - 1]} – ${stats.yearsCovered[0]}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline bounds */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-500" />
                <span>Timeline Bounds</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-neutral-900/50 border border-neutral-900 rounded-xl p-3">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Oldest Memory</span>
                  <span className="text-xs font-semibold text-neutral-300 mt-1 block">
                    {formatDate(stats.oldestMemory)}
                  </span>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-900 rounded-xl p-3">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Newest Memory</span>
                  <span className="text-xs font-semibold text-neutral-300 mt-1 block">
                    {formatDate(stats.newestMemory)}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col justify-center space-y-3">
              <h3 className="text-sm font-bold text-neutral-300">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onNavigateToTab('memories')}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/20 py-2.5 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-900/60 hover:text-white transition-all text-center"
                >
                  Browse Gallery
                </button>
                <button
                  onClick={() => onNavigateToTab('duplicates')}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/20 py-2.5 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-900/60 hover:text-white transition-all text-center"
                >
                  Manage Duplicates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
