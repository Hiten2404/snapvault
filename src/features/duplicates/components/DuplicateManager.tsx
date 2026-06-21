'use client';

import React, { useState } from 'react';
import { useDuplicates } from '../../../hooks/useDuplicates';
import ThumbnailImage from '../../../components/ThumbnailImage';
import { SnapchatMemory } from '../../../types';
import { 
  Copy, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  HardDrive, 
  FileCheck,
  Loader2
} from 'lucide-react';

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function DuplicateManager() {
  const { duplicateGroups, isLoading, isError, deleteDuplicates, isDeleting, potentialSavings } = useDuplicates();

  // State for checkmarked IDs to delete
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <p className="text-xs text-neutral-400">Scanning for duplicates...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">Failed to analyze duplicates.</p>
      </div>
    );
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Select all duplicates in a group except the first one (preferred copy)
  const handleKeepPreferredOnly = (groupMemories: SnapchatMemory[]) => {
    if (groupMemories.length <= 1) return;
    
    // We want to KEEP the first one, delete all others
    const preferredId = groupMemories[0].id;
    const updated = { ...selectedIds };
    
    groupMemories.forEach((m) => {
      if (m.id === preferredId) {
        updated[m.id] = false;
      } else {
        updated[m.id] = true;
      }
    });

    setSelectedIds(updated);
  };

  // Perform deletion
  const handleDeleteSelected = async () => {
    const idsToDelete = Object.entries(selectedIds)
      .filter(([_, select]) => select)
      .map(([id]) => id);

    if (idsToDelete.length === 0) return;

    if (confirm(`Are you sure you want to delete these ${idsToDelete.length} duplicate file(s)? This will free local browser storage.`)) {
      try {
        await deleteDuplicates(idsToDelete);
        setSelectedIds({}); // Clear selections
      } catch (err) {
        alert('Failed to delete duplicates.');
      }
    }
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  
  // Calculate selected space freed
  const getSelectedFreedBytes = () => {
    let bytes = 0;
    duplicateGroups.forEach((group) => {
      group.memories.forEach((m) => {
        if (selectedIds[m.id]) {
          bytes += m.size;
        }
      });
    });
    return bytes;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Duplicate Detection</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Exact file matching using local SHA-256 hashes.
          </p>
        </div>
      </div>

      {duplicateGroups.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-900 bg-neutral-900/10 py-16 text-center max-w-2xl mx-auto">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mb-4">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">No Duplicates Found</h2>
          <p className="text-xs text-neutral-550 mt-1 max-w-sm">
            All memories in your local archive are unique. Great job keeping a clean vault!
          </p>
        </div>
      ) : (
        /* Duplicates Content */
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <HardDrive className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Potential Savings</span>
                <span className="text-xl font-extrabold text-white">{formatBytes(potentialSavings)}</span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300">
                <Copy className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Duplicate Sets</span>
                <span className="text-xl font-extrabold text-white">{duplicateGroups.length} groups found</span>
              </div>
            </div>
          </div>

          {/* Duplicates Groups List */}
          <div className="space-y-6">
            {duplicateGroups.map((group, groupIdx) => {
              const totalSize = group.memories.reduce((sum, m) => sum + m.size, 0);
              return (
                <div 
                  key={group.sha256}
                  className="glass-card rounded-3xl p-5 border border-neutral-900 space-y-4"
                >
                  {/* Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-900/60 gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-neutral-250 flex items-center gap-2">
                        <span className="rounded-md bg-neutral-900 px-2 py-0.5 text-[9px] font-black text-neutral-450 uppercase">
                          Group {groupIdx + 1}
                        </span>
                        <span className="text-neutral-500 font-mono select-all">SHA-256: {group.sha256.substring(0, 16)}...</span>
                      </h3>
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        {group.memories.length} files • Combined size: {formatBytes(totalSize)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleKeepPreferredOnly(group.memories)}
                      className="rounded-xl border border-neutral-850 hover:bg-neutral-900 px-3 py-1.5 text-[10px] font-bold text-yellow-500 hover:text-yellow-400 transition-all select-none self-start sm:self-auto"
                    >
                      Keep Preferred Copy (Select others)
                    </button>
                  </div>

                  {/* Group Files Side-by-Side */}
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    {group.memories.map((m, idx) => {
                      const isSelected = !!selectedIds[m.id];
                      const isPreferred = idx === 0; // First sorted file is preferred

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleSelect(m.id)}
                          className={`flex items-center gap-4 rounded-2xl border p-3 cursor-pointer select-none transition-all ${
                            isSelected
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-neutral-900 bg-neutral-900/10 hover:border-neutral-850'
                          }`}
                        >
                          {/* Selector Checkbox */}
                          <div className="shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by outer div click
                              className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-red-500 focus:ring-red-500/20"
                            />
                          </div>

                          {/* Thumbnail */}
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-900 border border-neutral-850">
                            <ThumbnailImage
                              blob={m.thumbnailBlob}
                              type={m.type}
                              alt={m.filename}
                            />
                          </div>

                          {/* Metadata Details */}
                          <div className="flex-1 overflow-hidden">
                            <span className="block truncate text-xs font-bold text-neutral-300">
                              {m.filename}
                            </span>
                            <span className="block text-[10px] text-neutral-500 mt-0.5">
                              Date: {new Date(m.dateTaken).toLocaleDateString()} • Size: {formatBytes(m.size)}
                            </span>
                            <div className="mt-1 flex gap-1.5 items-center">
                              {isPreferred ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 text-[8px] font-bold text-emerald-450 uppercase">
                                  <FileCheck className="h-2 w-2" />
                                  <span>Preferred Copy</span>
                                </span>
                              ) : (
                                <span className="inline-block rounded bg-neutral-900 border border-neutral-800 px-1 py-0.2 text-[8px] font-semibold text-neutral-500 uppercase">
                                  Duplicate
                                </span>
                              )}
                              {m.isCombined && (
                                <span className="inline-block rounded bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 text-[8px] font-bold text-amber-500 uppercase">
                                  Combined
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Action Footer when items are selected */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/20 bg-neutral-950/90 p-4 shadow-2xl backdrop-blur-md">
            <div>
              <span className="block text-xs font-bold text-white">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <span className="block text-[10px] text-red-400 mt-0.5">
                Freed Space: {formatBytes(getSelectedFreedBytes())}
              </span>
            </div>

            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <Trash2 className="h-4.5 w-4.5" />
              )}
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
