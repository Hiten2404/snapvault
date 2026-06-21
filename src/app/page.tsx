'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Sidebar, { SidebarTab } from '../components/Sidebar';
import Dashboard from '../features/dashboard/components/Dashboard';
import MemoryGallery from '../features/gallery/components/MemoryGallery';
import TimelineView from '../features/timeline/components/TimelineView';
import DuplicateManager from '../features/duplicates/components/DuplicateManager';
import DownloadManager from '../features/downloads/components/DownloadManager';
import SettingsView from '../features/settings/components/SettingsView';
import ImportModal from '../features/import/components/ImportModal';
import MemoryDetail from '../features/gallery/components/MemoryDetail';
import { SnapchatMemory } from '../types';
import { useMemories } from '../hooks/useMemories';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { memories } = useMemories();

  // Tab State
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');

  // Selected memories state lifted for global sync
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Record<string, boolean>>({});

  // Modal / Lightbox States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<SnapchatMemory | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Compute memory list for lightbox slide navigation
  const sortedMemories = useMemo(() => {
    return [...memories].sort(
      (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
    );
  }, [memories]);

  // Handlers for sliding next/previous in details view
  const handleNextMemory = () => {
    if (!selectedMemory || sortedMemories.length === 0) return;
    const currentIndex = sortedMemories.findIndex((m) => m.id === selectedMemory.id);
    if (currentIndex !== -1 && currentIndex < sortedMemories.length - 1) {
      setSelectedMemory(sortedMemories[currentIndex + 1]);
    }
  };

  const handlePreviousMemory = () => {
    if (!selectedMemory || sortedMemories.length === 0) return;
    const currentIndex = sortedMemories.findIndex((m) => m.id === selectedMemory.id);
    if (currentIndex > 0) {
      setSelectedMemory(sortedMemories[currentIndex - 1]);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-yellow-500" />
          <p className="text-xs text-neutral-500">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return null; // Page will redirect in useEffect
  }

  // Render tab component content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onTriggerImport={() => setIsImportOpen(true)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'memories':
        return (
          <MemoryGallery 
            onSelectMemory={(m) => setSelectedMemory(m)} 
            selectedMemoryIds={selectedMemoryIds}
            setSelectedMemoryIds={setSelectedMemoryIds}
          />
        );
      case 'timeline':
        return (
          <TimelineView 
            onSelectMemory={(m) => setSelectedMemory(m)} 
            selectedMemoryIds={selectedMemoryIds}
            setSelectedMemoryIds={setSelectedMemoryIds}
          />
        );
      case 'duplicates':
        return <DuplicateManager />;
      case 'downloads':
        return (
          <DownloadManager 
            selectedMemoryIds={selectedMemoryIds}
            setSelectedMemoryIds={setSelectedMemoryIds}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-neutral-950">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

      {/* Main Panel Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 max-w-7xl mx-auto w-full">
        {renderTabContent()}
      </main>

      {/* ZIP Import Wizard Overlay */}
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {/* Lightbox Details Panel Overlay */}
      {selectedMemory && (
        <MemoryDetail
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onNext={
            sortedMemories.findIndex((m) => m.id === selectedMemory.id) < sortedMemories.length - 1
              ? handleNextMemory
              : undefined
          }
          onPrevious={
            sortedMemories.findIndex((m) => m.id === selectedMemory.id) > 0
              ? handlePreviousMemory
              : undefined
          }
        />
      )}
    </div>
  );
}
