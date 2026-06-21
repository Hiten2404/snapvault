'use client';

import React, { useState, useMemo } from 'react';
import { useMemories } from '../../../hooks/useMemories';
import { getMediaBlob } from '../../../services/indexedDB';
import { repairJpegExif } from '../../metadata/utils/exifRepair';
import { SnapchatMemory } from '../../../types';
import ThumbnailImage from '../../../components/ThumbnailImage';
import JSZip from 'jszip';
import { 
  Download, 
  FileArchive, 
  Calendar, 
  Layers, 
  Loader2, 
  CheckCircle,
  HardDriveUpload,
  CheckSquare,
  Check,
  Search
} from 'lucide-react';

// Help helper to get exportable blob with latest EXIF corrections
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
      // Re-apply latest metadata changes
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

interface DownloadManagerProps {
  selectedMemoryIds: Record<string, boolean>;
  setSelectedMemoryIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export default function DownloadManager({ selectedMemoryIds, setSelectedMemoryIds }: DownloadManagerProps) {
  const { memories } = useMemories();
  
  // Progress states
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [completed, setCompleted] = useState(false);
  
  // Selection states for year/month exports
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('');

  // Selected memories checklist states
  const [showGrid, setShowGrid] = useState(false);
  const [exportSearch, setExportSearch] = useState('');

  // Extract years and months list from memories
  const { years, months } = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsMap = new Map<string, { label: string; year: string; monthVal: number }>();

    memories.forEach((m) => {
      const date = new Date(m.dateTaken);
      if (!isNaN(date.getTime())) {
        const yearStr = date.getFullYear().toString();
        yearsSet.add(yearStr);

        const monthVal = date.getMonth();
        const monthLabel = date.toLocaleString('default', { month: 'long' });
        const key = `${yearStr}-${monthVal}`;
        monthsMap.set(key, {
          label: `${monthLabel} ${yearStr}`,
          year: yearStr,
          monthVal,
        });
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
    const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => {
      if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
      return b.monthVal - a.monthVal;
    });

    return { years: sortedYears, months: sortedMonths };
  }, [memories]);

  // Set default selection values
  React.useEffect(() => {
    if (years.length > 0 && !selectedYear) setSelectedYear(years[0]);
    if (months.length > 0 && !selectedMonthYear) setSelectedMonthYear(`${months[0].year}-${months[0].monthVal}`);
  }, [years, months, selectedYear, selectedMonthYear]);

  const handleToggleSelect = (id: string) => {
    setSelectedMemoryIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedMemoryIds).filter(Boolean).length;
  }, [selectedMemoryIds]);

  const filteredExportMemories = useMemo(() => {
    // Sort memories chronologically (newest first)
    const sorted = [...memories].sort(
      (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
    );
    if (!exportSearch) return sorted;
    const q = exportSearch.toLowerCase();
    return sorted.filter((m) => {
      const matchName = m.filename.toLowerCase().includes(q);
      const date = new Date(m.dateTaken);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear().toString();
        const month = date.toLocaleString('default', { month: 'long' }).toLowerCase();
        return matchName || year.includes(q) || month.includes(q);
      }
      return matchName;
    });
  }, [memories, exportSearch]);

  const handleSelectAll = () => {
    const updated: Record<string, boolean> = {};
    filteredExportMemories.forEach((m) => {
      updated[m.id] = true;
    });
    setSelectedMemoryIds((prev) => ({ ...prev, ...updated }));
  };

  const handleDeselectAll = () => {
    setSelectedMemoryIds({});
  };

  // General export logic
  const triggerZipExport = async (filterFn: (m: SnapchatMemory) => boolean, zipName: string) => {
    const targets = memories.filter(filterFn);
    if (targets.length === 0) {
      alert('No memories found matching selection.');
      return;
    }

    setIsExporting(true);
    setCompleted(false);
    const zip = new JSZip();

    try {
      let count = 0;
      const total = targets.length;

      for (const m of targets) {
        setProgressText(`Fetching and repairing media: ${count + 1} / ${total}`);
        const exportBlob = await getExportableBlob(m);
        
        // Add to ZIP (use base filename to avoid folders complexity)
        zip.file(m.filename, exportBlob);
        count++;
      }

      setProgressText('Compressing files into ZIP archive...');
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setProgressText(`Compressing ZIP: ${Math.round(metadata.percent)}%`);
      });

      setProgressText('Downloading export...');
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCompleted(true);
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    } finally {
      setIsExporting(false);
      setProgressText('');
    }
  };

  const handleExportAll = () => {
    triggerZipExport(() => true, 'snapvault-full-export');
  };

  const handleExportYear = () => {
    if (!selectedYear) return;
    triggerZipExport(
      (m) => new Date(m.dateTaken).getFullYear().toString() === selectedYear,
      `snapvault-export-${selectedYear}`
    );
  };

  const handleExportMonth = () => {
    if (!selectedMonthYear) return;
    const [year, monthVal] = selectedMonthYear.split('-');
    triggerZipExport(
      (m) => {
        const date = new Date(m.dateTaken);
        return date.getFullYear().toString() === year && date.getMonth().toString() === monthVal;
      },
      `snapvault-export-${year}-${monthVal}`
    );
  };

  const handleExportSelected = () => {
    triggerZipExport(
      (m) => !!selectedMemoryIds[m.id],
      'snapvault-selected-export'
    );
  };

  const isEmpty = memories.length === 0;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">ZIP Exporter</h1>
        <p className="text-xs text-neutral-450 mt-1">
          Export memories to files with preserved EXIF headers and GPS coordinates.
        </p>
      </div>

      {isEmpty ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-900 bg-neutral-900/10 py-16 text-center max-w-2xl mx-auto">
          <HardDriveUpload className="h-10 w-10 text-neutral-600 mb-4" />
          <h2 className="text-sm font-bold text-neutral-400">Export Unlocked After Import</h2>
          <p className="text-xs text-neutral-550 mt-1 max-w-sm">
            Once you import your Snapchat ZIP archive, you will be able to export timeline segments here.
          </p>
        </div>
      ) : (
        /* Exporters grid */
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          {/* Card: Export Entire Archive */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                <FileArchive className="h-5.5 w-5.5" />
              </div>
              <h3 className="text-sm font-bold text-white">Export Entire Archive</h3>
              <p className="text-xs text-neutral-450 leading-relaxed">
                Pack all {memories.length} repaired memories into a single ZIP file. Exif tags will be written to all images.
              </p>
            </div>
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-bold py-3 text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Download Full ZIP</span>
            </button>
          </div>

          {/* Card: Export Selected Memories (New Requested Feature) */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 flex flex-col justify-between space-y-4 md:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 border border-neutral-850 text-neutral-300">
                  <CheckSquare className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Export Selected Memories</h3>
                  <p className="text-xs text-neutral-450 leading-relaxed">
                    Choose specific memories from your archive and package them into a custom ZIP file.
                  </p>
                </div>
              </div>

              {/* Toggle Selection Grid */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-neutral-900 pt-4">
                <span className="text-xs font-semibold text-neutral-400">
                  {selectedCount} memory(s) selected for export
                </span>
                
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className="rounded-xl border border-neutral-850 hover:bg-neutral-900 py-1.5 px-3.5 text-xs font-bold text-neutral-300 transition-all select-none"
                >
                  {showGrid ? 'Hide Selection Grid' : 'Show Selection Grid'}
                </button>
              </div>

              {/* Selection Grid Panel */}
              {showGrid && (
                <div className="space-y-3 pt-2 animate-fade-in border-t border-neutral-900">
                  <div className="flex gap-2 items-center">
                    {/* Search bar inside selection grid */}
                    <div className="relative flex-1">
                      <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Search select grid..."
                        value={exportSearch}
                        onChange={(e) => setExportSearch(e.target.value)}
                        className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 py-2 pl-9 pr-4 text-xs text-neutral-250 placeholder-neutral-500 focus:outline-none"
                      />
                    </div>
                    {/* Select All / Deselect All */}
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="rounded-lg bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 py-1.5 px-3 text-[10px] font-bold text-neutral-350 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="rounded-lg bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 py-1.5 px-3 text-[10px] font-bold text-neutral-350 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Grid wrap with custom scrollbar */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-60 overflow-y-auto pr-1 border border-neutral-900/50 bg-neutral-900/10 rounded-xl p-2.5">
                    {filteredExportMemories.map((m) => {
                      const isSelected = !!selectedMemoryIds[m.id];
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleSelect(m.id)}
                          className={`aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-950 border transition-all relative ${
                            isSelected ? 'border-yellow-500/80 shadow-md shadow-yellow-500/5' : 'border-neutral-900/85 hover:border-neutral-800'
                          }`}
                        >
                          <ThumbnailImage
                            blob={m.thumbnailBlob}
                            type={m.type}
                            alt={m.filename}
                          />
                          {/* Checkbox overlay */}
                          <div className={`absolute top-1.5 left-1.5 flex h-4.5 w-4.5 items-center justify-center rounded border ${
                            isSelected ? 'bg-yellow-500 border-yellow-500 text-neutral-950' : 'bg-neutral-950/80 border-neutral-800'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportSelected}
              disabled={isExporting || selectedCount === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-900 disabled:text-neutral-600 font-bold py-3 text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Download Selected Memories ({selectedCount})</span>
            </button>
          </div>

          {/* Card: Export by Year */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Export by Year</h3>
              <p className="text-xs text-neutral-450 leading-relaxed">
                Select a year to bundle its memories. Useful for parsing large archives into smaller size packages.
              </p>
              
              {/* Year Selector */}
              <div className="pt-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  disabled={isExporting}
                  className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-250 focus:outline-none"
                >
                  {years.map((year) => (
                    <option key={year} value={year} className="bg-neutral-950">
                      {year} ({memories.filter((m) => new Date(m.dateTaken).getFullYear().toString() === year).length} memories)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <button
              onClick={handleExportYear}
              disabled={isExporting || !selectedYear}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-850 hover:bg-neutral-900 text-neutral-200 py-3 text-xs font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export Year Archive</span>
            </button>
          </div>

          {/* Card: Export by Month */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Export by Month</h3>
              <p className="text-xs text-neutral-450 leading-relaxed">
                Bundle memories for a specific month. Offers fine grain export controls.
              </p>

              {/* Month Selector */}
              <div className="pt-2">
                <select
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonthYear(e.target.value)}
                  disabled={isExporting}
                  className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 p-2.5 text-xs text-neutral-250 focus:outline-none"
                >
                  {months.map((m) => {
                    const count = memories.filter((mem) => {
                      const date = new Date(mem.dateTaken);
                      return date.getFullYear().toString() === m.year && date.getMonth().toString() === m.monthVal.toString();
                    }).length;

                    return (
                      <option key={`${m.year}-${m.monthVal}`} value={`${m.year}-${m.monthVal}`} className="bg-neutral-950">
                        {m.label} ({count} memories)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <button
              onClick={handleExportMonth}
              disabled={isExporting || !selectedMonthYear}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-850 hover:bg-neutral-900 text-neutral-200 py-3 text-xs font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export Month Archive</span>
            </button>
          </div>

          {/* Progress Modal overlay when generating ZIP */}
          {isExporting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl glass-card flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Generating ZIP File...</h4>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
                    {progressText}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Completion Banner */}
          {completed && (
            <div className="fixed bottom-6 right-6 z-40 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center gap-3">
              <CheckCircle className="h-5 w-5" />
              <div>
                <span className="block text-xs font-bold">Export Complete</span>
                <span className="block text-[10px] text-neutral-450 mt-0.5">Your download has started.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
