'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileArchive,
  FolderOpen,
  ShieldCheck,
  FolderArchive,
  Info
} from 'lucide-react';
import { processSnapchatZip, processSnapchatFolder } from '../services/zipProcessor';
import { getSettings } from '../../../services/indexedDB';
import { ImportProgress, UserSettings } from '../../../types';
import { useQueryClient } from '@tanstack/react-query';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const queryClient = useQueryClient();
  
  // Selection states
  const [importType, setImportType] = useState<'folder' | 'zip'>('folder');
  const [file, setFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    step: 'idle',
    percentage: 0,
    statusText: '',
  });

  // Import configurations
  const [pref, setPref] = useState<'originals' | 'combined' | 'both'>('both');
  const [repairExif, setRepairExif] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const isZipTooLarge = useMemo(() => {
    if (importType === 'zip' && file) {
      return file.size > 2 * 1024 * 1024 * 1024; // 2 GB
    }
    return false;
  }, [importType, file]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (importType === 'zip') {
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0 && droppedFiles[0].name.endsWith('.zip')) {
        setFile(droppedFiles[0]);
      }
    }
    // Note: Folder dropping is not natively supported in standard webkitdirectory file inputs easily.
    // We guide the user to click the browse button for folders.
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFile(selectedFiles[0]);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFolderFiles(Array.from(selectedFiles));
    }
  };

  const startImport = async () => {
    const hasData = importType === 'folder' ? folderFiles.length > 0 : !!file;
    if (!hasData) return;
    setImporting(true);

    try {
      const activeSettings: UserSettings = {
        theme: 'dark',
        importPreference: pref,
        autoRepairMetadata: repairExif,
        saveGpsIfAvailable: true,
      };

      if (importType === 'folder') {
        await processSnapchatFolder(folderFiles, activeSettings, (prog) => {
          setProgress(prog);
        });
      } else {
        await processSnapchatZip(file!, activeSettings, (prog) => {
          setProgress(prog);
        });
      }

      // Invalidate React Query caches to trigger updates across the app
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    } catch (err: any) {
      setProgress({
        step: 'error',
        percentage: 100,
        statusText: 'Import failed',
        errorText: err.message || 'An unknown error occurred.',
      });
    }
  };

  const resetModal = () => {
    setFile(null);
    setFolderFiles([]);
    setImporting(false);
    setProgress({
      step: 'idle',
      percentage: 0,
      statusText: '',
    });
  };

  const handleClose = () => {
    if (importing && progress.step !== 'complete' && progress.step !== 'error') {
      if (!confirm('Import is in progress. Closing this dialog will not stop the process but might cause UI sync issues. Close anyway?')) {
        return;
      }
    }
    resetModal();
    onClose();
  };

  const getFolderName = () => {
    if (folderFiles.length === 0) return '';
    const path = folderFiles[0].webkitRelativePath;
    return path.split('/')[0] || 'Selected Folder';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={handleClose}
        className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" 
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl glass animate-fade-in overflow-hidden">
        {/* Hidden inputs mounted persistently */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".zip"
          className="hidden"
        />

        {/* Folder input element with directory attributes */}
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderChange}
          {...{ webkitdirectory: '', directory: '', multiple: true }}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-900 pb-4 mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderArchive className="h-5.5 w-5.5 text-yellow-500" />
            <span>Import Snapchat Memories</span>
          </h2>
          <button 
            onClick={handleClose}
            className="rounded-lg p-1.5 text-neutral-450 hover:bg-neutral-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher - Hidden during import */}
        {!importing && (
          <div className="flex rounded-xl bg-neutral-900/60 p-1 border border-neutral-900 mb-5">
            <button
              type="button"
              onClick={() => setImportType('folder')}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${
                importType === 'folder'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-450 hover:text-neutral-200'
              }`}
            >
              Unzipped Folder (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setImportType('zip')}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${
                importType === 'zip'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-450 hover:text-neutral-200'
              }`}
            >
              ZIP File (Max 2GB)
            </button>
          </div>
        )}

        {/* Progress View */}
        {importing ? (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              {progress.step === 'complete' ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6 animate-pulse" />
                </div>
              ) : progress.step === 'error' ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
                  <AlertCircle className="h-6 w-6" />
                </div>
              ) : (
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                </div>
              )}

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-200">
                  {progress.step === 'complete' ? 'Import Complete!' : progress.step === 'error' ? 'Import Failed' : 'Processing Archive...'}
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm">
                  {progress.statusText}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {progress.step !== 'error' && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-900">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Progress</span>
                  <span className="font-semibold">{progress.percentage}%</span>
                </div>
              </div>
            )}

            {/* Stats Breakdown */}
            {progress.stats && (
              <div className="grid grid-cols-2 gap-2 bg-neutral-900/40 border border-neutral-900/50 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-neutral-500">Total Matched:</span>
                  <span className="ml-1.5 font-bold text-neutral-300">{progress.stats.totalFiles}</span>
                </div>
                <div>
                  <span className="text-neutral-500">EXIF Repaired:</span>
                  <span className="ml-1.5 font-bold text-emerald-400">{progress.stats.repairedCount}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {progress.step === 'error' && (
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 text-xs text-red-400 max-h-48 overflow-y-auto">
                <p className="font-semibold">Error details:</p>
                <p className="mt-1 opacity-90">{progress.errorText}</p>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-900">
              {progress.step === 'error' && (
                <button
                  onClick={resetModal}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 px-4 py-2 text-xs font-semibold text-neutral-300 transition-all active:scale-[0.98]"
                >
                  Try Again
                </button>
              )}
              {(progress.step === 'complete' || progress.step === 'error') && (
                <button
                  onClick={handleClose}
                  className="rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-bold px-5 py-2 text-xs shadow-md transition-all active:scale-[0.98]"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ) : (
          /* File selection and config view */
          <div className="space-y-6">
            {importType === 'folder' ? (
              /* Folder Selector Panel */
              folderFiles.length === 0 ? (
                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-900/10 p-8 text-center cursor-pointer hover:border-neutral-700 hover:bg-neutral-900/20 transition-all duration-200"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 mb-4">
                    <FolderOpen className="h-6 w-6 text-yellow-500" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-200">Select Snapchat Export Folder</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-normal">
                    Click to select your unzipped Snapchat Data Export directory (containing `html/` or `memories/` folders).
                  </p>
                </div>
              ) : (
                /* Selected Folder Info Banner */
                <div className="flex items-center justify-between rounded-xl bg-neutral-900/60 border border-neutral-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 shrink-0">
                      <FolderOpen className="h-5.5 w-5.5" />
                    </div>
                    <div className="overflow-hidden">
                      <span className="block truncate text-xs font-bold text-neutral-250">
                        {getFolderName()}
                      </span>
                      <span className="block text-[10px] text-neutral-500">
                        {folderFiles.length} files detected in folder
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setFolderFiles([])}
                    className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            ) : (
              /* ZIP Selector Panel */
              !file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-yellow-500 bg-yellow-500/5'
                      : 'border-neutral-800 bg-neutral-900/10 hover:border-neutral-700 hover:bg-neutral-900/20'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 mb-4">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-200">Drag & Drop ZIP File</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-normal">
                    Drop your Snapchat Data Export ZIP file here, or click to browse.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-neutral-900/60 border border-neutral-900 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 shrink-0">
                        <FileArchive className="h-5.5 w-5.5" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="block truncate text-xs font-bold text-neutral-250">
                          {file.name}
                        </span>
                        <span className="block text-[10px] text-neutral-500">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Size Limit Warning */}
                  {isZipTooLarge && (
                    <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/15 rounded-xl p-3 text-xs text-red-400">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">ZIP Exceeds 2GB Limit</p>
                        <p className="mt-0.5 leading-normal opacity-90 text-[10px]">
                          Browser runtime environments cannot allocate contiguous buffers larger than 2GB. Try unzipping this archive and uploading using the <strong>Unzipped Folder</strong> tab instead.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Options Configuration */}
            <div className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Settings2 className="h-4 w-4 text-neutral-400" />
                <span>Import Preferences</span>
              </h3>

              {/* Original vs Combined Handling */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-neutral-455">
                  Original vs Combined Files
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPref('both')}
                    className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                      pref === 'both'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold'
                        : 'border-neutral-800 bg-neutral-900/30 text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-300'
                    }`}
                  >
                    Keep Both
                  </button>
                  <button
                    type="button"
                    onClick={() => setPref('originals')}
                    className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                      pref === 'originals'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold'
                        : 'border-neutral-800 bg-neutral-900/30 text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'
                    }`}
                  >
                    Original Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPref('combined')}
                    className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                      pref === 'combined'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold'
                        : 'border-neutral-800 bg-neutral-900/30 text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'
                    }`}
                  >
                    Combined Only
                  </button>
                </div>
              </div>

              {/* EXIF Repair Toggle */}
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={repairExif}
                  onChange={(e) => setRepairExif(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-yellow-500 focus:ring-yellow-500/20 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-neutral-250">
                    Repair & Write EXIF Metadata
                  </span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5 leading-normal">
                    Injects Date Taken and GPS coordinates into image metadata headers.
                  </span>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-900">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-neutral-450 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startImport}
                disabled={importType === 'folder' ? folderFiles.length === 0 : (!file || isZipTooLarge)}
                className="rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-900 disabled:text-neutral-600 font-bold px-6 py-2.5 text-xs shadow-md transition-all active:scale-[0.98]"
              >
                Start Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
