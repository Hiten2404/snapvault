'use client';

import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getStats, clearDatabase } from '../../../services/indexedDB';
import { UserSettings, ArchiveStats } from '../../../types';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Trash2, 
  Database, 
  ToggleLeft, 
  ShieldCheck, 
  Sparkles,
  HardDrive,
  Info,
  Check,
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

export default function SettingsView() {
  const queryClient = useQueryClient();
  
  // Settings states
  const [pref, setPref] = useState<UserSettings>({
    theme: 'dark',
    importPreference: 'both',
    autoRepairMetadata: true,
    saveGpsIfAvailable: true,
  });

  // Database stats state
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isWiping, setIsWiping] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings and stats
  useEffect(() => {
    async function loadData() {
      try {
        const loadedPref = await getSettings();
        setPref(loadedPref);

        const loadedStats = await getStats();
        setStats(loadedStats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStats(false);
      }
    }
    loadData();
  }, []);

  const handleSaveSettings = async (updated: UserSettings) => {
    setPref(updated);
    await saveSettings(updated);
    
    // Show success check
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleWipeDatabase = async () => {
    if (
      confirm(
        'Are you absolutely sure you want to wipe your SnapVault? This will delete all memories and media blobs stored in your browser local storage. This action cannot be undone.'
      )
    ) {
      setIsWiping(true);
      try {
        await clearDatabase();
        
        // Reload page stats
        const loadedStats = await getStats();
        setStats(loadedStats);
        
        // Invalidate react query cache
        queryClient.invalidateQueries({ queryKey: ['memories'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['duplicates'] });

        alert('Database cleared successfully.');
      } catch (err) {
        alert('Failed to clear database.');
      } finally {
        setIsWiping(false);
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="text-xs text-neutral-450 mt-1">
          Configure uploader preferences, metadata repair rules, and local storage limits.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: General Prefs & Metadata Repair */}
        <div className="md:col-span-2 space-y-6">
          {/* Box: Metadata Repair Rules */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 space-y-5">
            <h2 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span>Metadata Repair Engine</span>
            </h2>

            <div className="space-y-4">
              <label className="flex items-start gap-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pref.autoRepairMetadata}
                  onChange={(e) => {
                    handleSaveSettings({
                      ...pref,
                      autoRepairMetadata: e.target.checked,
                    });
                  }}
                  className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-yellow-500 focus:ring-yellow-500/20 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-neutral-250">
                    Repair & Write EXIF Headers
                  </span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5 leading-normal">
                    Automatically inject DateTimeOriginal tag into JPEG files during ZIP processing.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pref.saveGpsIfAvailable}
                  onChange={(e) => {
                    handleSaveSettings({
                      ...pref,
                      saveGpsIfAvailable: e.target.checked,
                    });
                  }}
                  className="h-4.5 w-4.5 rounded border-neutral-800 bg-neutral-900 text-yellow-500 focus:ring-yellow-500/20 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-neutral-250">
                    Preserve GPS Coordinates
                  </span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5 leading-normal">
                    Insert GPS latitude/longitude data into EXIF if present in the Snapchat metadata history.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Box: ZIP Import Default Options */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 space-y-5">
            <h2 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Settings className="h-4 w-4 text-neutral-400" />
              <span>ZIP Uploader Behavior</span>
            </h2>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-neutral-300">
                Original vs Combined Defaults
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['both', 'originals', 'combined'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      handleSaveSettings({
                        ...pref,
                        importPreference: val as any,
                      });
                    }}
                    className={`rounded-xl border py-2.5 px-3 text-xs font-semibold transition-all ${
                      pref.importPreference === val
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-bold'
                        : 'border-neutral-900 bg-neutral-900/30 text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'
                    }`}
                  >
                    {val === 'both' ? 'Keep Both' : val === 'originals' ? 'Originals Only' : 'Combined Only'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 leading-normal">
                Determine Snapchat export duplicate filtering behaviour when a memory has both raw files and edited frame wrappers.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Storage Management & Info */}
        <div className="space-y-6">
          {/* Storage Details */}
          <div className="glass-card rounded-3xl p-6 border border-neutral-900 space-y-5">
            <h2 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Database className="h-4 w-4 text-sky-400" />
              <span>Storage Manager</span>
            </h2>

            {loadingStats || !stats ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-wider">IndexedDB Usage</span>
                  <span className="text-lg font-black text-white flex items-baseline gap-1">
                    {formatBytes(stats.storageUsedBytes)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-400 border-t border-neutral-900/60 pt-3">
                  <div className="flex justify-between">
                    <span>Index Counts:</span>
                    <span className="font-bold text-neutral-300">{stats.totalMemories} files</span>
                  </div>
                </div>

                {/* Reset Button */}
                <button
                  onClick={handleWipeDatabase}
                  disabled={isWiping || stats.totalMemories === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-650 hover:bg-red-650/90 text-white font-bold py-2.5 text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear Vault Storage</span>
                </button>
              </div>
            )}
          </div>

          {/* Privacy Box */}
          <div className="glass-card rounded-3xl p-5 border border-neutral-900 bg-neutral-900/10 space-y-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-xs font-bold text-white">Privacy Secured</h3>
            <p className="text-[10px] text-neutral-500 leading-normal">
              SnapVault stores all credentials, metadata index, images, and videos exclusively inside your local IndexedDB. No server uploads or cloud analytics are implemented.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Save Status */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-40 bg-neutral-900 border border-yellow-500/20 text-yellow-500 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center gap-3">
          <Check className="h-5 w-5 text-yellow-500" />
          <div>
            <span className="block text-xs font-bold">Preferences Saved</span>
            <span className="block text-[10px] text-neutral-500 mt-0.5">Settings updated successfully.</span>
          </div>
        </div>
      )}
    </div>
  );
}
