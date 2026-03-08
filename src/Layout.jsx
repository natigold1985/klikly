import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CheckSquare,
  Settings,
  HardDrive,
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings } = useQuery({
    queryKey: ['layoutSettings'],
    queryFn: async () => {
      const allSettings = await base44.entities.PhotographerSettings.list();
      return allSettings[0] || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isClient = user?.role === 'client';

  const sidebarNavigation = isClient
    ? [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'הפרויקטים שלי', icon: Briefcase, page: 'Projects' },
        { name: 'קבצים להורדה', icon: HardDrive, page: 'FileStorage' },
        { name: 'משימות', icon: CheckSquare, page: 'Tasks' },
      ]
    : [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
        { name: 'משימות', icon: CheckSquare, page: 'Tasks' },
        { name: 'אחסון קבצים', icon: HardDrive, page: 'FileStorage' },
        { name: 'הגדרות', icon: Settings, page: 'Settings' },
      ];

  const mobileNavItems = isClient
    ? [
        { name: 'לוח', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'קבצים', icon: HardDrive, page: 'FileStorage' },
        { name: 'משימות', icon: CheckSquare, page: 'Tasks' },
      ]
    : [
        { name: 'לוח', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'הגדרות', icon: Settings, page: 'Settings' },
      ];

  // Pages that should render without any nav (e.g. public client pages)
  const noLayoutPages = ['DownloadPage', 'QuoteView'];
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir="rtl">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0a0a] text-white flex-shrink-0 h-full">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <span className="text-xl font-bold tracking-wider text-[#D4AF37]">
            {settings?.business_name || 'Klikly'}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-[#D4AF37] text-black'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        {user && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-sm flex-shrink-0">
                {user.full_name?.[0] || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-xs text-white/40 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-5 h-14 bg-white border-b border-slate-100 flex-shrink-0">
          <span className="text-lg font-bold tracking-wide text-[#D4AF37]">
            {settings?.business_name || 'Klikly'}
          </span>
          {user && (
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-sm">
              {user.full_name?.[0] || '?'}
            </div>
          )}
        </header>

        {/* Page Content — scrollable, padded for bottom nav on mobile */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPageName === item.page;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.page)}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors active:scale-95 ${
                isActive ? 'text-[#C5A028]' : 'text-slate-400'
              }`}
              style={{ minHeight: '56px' }}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-[#D4AF37]/12' : ''}`}>
                <Icon
                  className="w-6 h-6"
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#C5A028]' : 'text-slate-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}