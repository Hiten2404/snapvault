'use client';

import { useSession, signOut } from 'next-auth/react';
import { 
  LayoutDashboard, 
  Image as ImageIcon, 
  CalendarDays, 
  Copy, 
  Download, 
  Settings, 
  LogOut, 
  Shield, 
  Menu, 
  X,
  Database
} from 'lucide-react';
import { useState } from 'react';

export type SidebarTab = 'dashboard' | 'memories' | 'timeline' | 'duplicates' | 'downloads' | 'settings';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'memories', label: 'Memories', icon: ImageIcon },
    { id: 'timeline', label: 'Timeline', icon: CalendarDays },
    { id: 'duplicates', label: 'Duplicates', icon: Copy },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const handleTabClick = (tabId: SidebarTab) => {
    onTabChange(tabId);
    setIsOpen(false); // Close mobile menu
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="flex h-16 items-center justify-between border-b border-neutral-900 bg-neutral-950 px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-yellow-400 to-amber-500 shadow-md shadow-yellow-500/10">
            <Shield className="h-4.5 w-4.5 text-neutral-950" />
          </div>
          <span className="font-bold text-white text-base">SnapVault</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-950/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-900 bg-neutral-950/80 backdrop-blur-md transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Title / Logo */}
        <div className="flex h-16 items-center gap-2.5 px-6 border-b border-neutral-900/50">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-yellow-400 to-amber-500 shadow-md shadow-yellow-500/25">
            <Shield className="h-5 w-5 text-neutral-950" />
          </div>
          <div>
            <span className="font-extrabold text-white text-lg tracking-tight">SnapVault</span>
            <span className="block text-[10px] text-neutral-500 font-semibold tracking-wider uppercase">Local Archive</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-6">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-100 border border-transparent'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-yellow-400' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="border-t border-neutral-900/50 p-4 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-neutral-900/40 border border-neutral-900 p-3">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-10 w-10 rounded-xl bg-neutral-800"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800">
                <Database className="h-5 w-5 text-neutral-400" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <span className="block truncate text-xs font-bold text-neutral-200">
                {session?.user?.name || 'Local Archive'}
              </span>
              <span className="block truncate text-[10px] text-neutral-500">
                {session?.user?.email || 'offline-sandbox'}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900/20 py-2.5 text-xs font-medium text-neutral-400 hover:bg-neutral-900/60 hover:text-red-400 hover:border-red-950 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
