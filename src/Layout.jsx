import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings as SettingsIcon,
  Folder,
  CheckCircle2,
  Menu,
  Shield
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  // Fallback for currentPageName if not provided
  const pageName = currentPageName || location.pathname.split('/').pop() || 'Home';

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

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';
  const isClient = user?.role === 'client' && !isAdmin;

  // Desktop Sidebar Items
  const sidebarNavigation = isClient
    ? [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'הפרויקטים שלי', icon: Briefcase, page: 'Projects' },
        { name: 'קבצים להורדה', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
      ]
    : [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'אחסון קבצים', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
        ...(isAdmin ? [{ name: 'משתמשים', icon: Shield, page: 'AdminUsers' }] : []),
        { name: 'הגדרות', icon: SettingsIcon, page: 'Settings' },
      ];

  // Mobile Bottom Navigation Items (Fixed as requested: Dashboard, Leads, Projects, Settings)
  const mobileNavItems = isClient
    ? [
        { name: 'לוח', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'קבצים', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
      ]
    : [
        { name: 'לוח', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'הגדרות', icon: SettingsIcon, page: 'Settings' },
      ];

  // Pages that should render without any nav
  const noLayoutPages = ['DownloadPage', 'QuoteView'];
  // Handle System Dark Mode
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    // Initial check
    handleChange(mediaQuery);
    
    // Listener
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (noLayoutPages.includes(pageName)) {
    return children;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-50 transition-colors duration-300" dir="rtl">
      
      {/* ── Mobile Header (Central Logo) ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 z-40 flex items-center justify-center px-4 shadow-sm">
        {/* User Avatar (Left aligned in RTL) */}
        {user && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
             <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
              {user.full_name?.[0] || '?'}
            </div>
          </div>
        )}
        
        {/* Central Logo / Title */}
        <div className="flex flex-col items-center">
           <span className="text-lg font-extrabold tracking-tight text-[#D4AF37]">
            {settings?.business_name || 'Klikly'}
          </span>
        </div>

        {/* Placeholder for right side balance or menu trigger if needed */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9"></div>
      </header>

      {/* ── Desktop Sidebar (Hidden on Mobile) ── */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0a0a0a] text-white flex-shrink-0 h-full border-l border-white/5 transition-all duration-300">
        {/* Logo */}
        <div className="h-20 flex items-center px-8 border-b border-white/10 bg-[#0a0a0a]">
          <span className="text-2xl font-bold tracking-wider text-[#D4AF37]">
            {settings?.business_name || 'Klikly'}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {sidebarNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black shadow-lg shadow-yellow-900/20 font-bold'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-black' : 'text-white/50 group-hover:text-white'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        {user && (
          <div className="p-6 border-t border-white/10 bg-[#050505]">
            <div className="flex items-center gap-4 p-2 rounded-lg bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#b38f2d] flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user.full_name?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-xs text-white/40 truncate">{isAdmin ? 'מנהל מערכת' : 'לקוח'}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 md:pt-0 pb-24 md:pb-0 px-4 md:px-8 bg-slate-50">
          <div className="max-w-6xl mx-auto w-full py-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Fixed) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 z-50 flex items-stretch shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pageName === item.page;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.page)}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform duration-100"
            >
              <div className={`relative p-1.5 rounded-2xl transition-colors ${isActive ? 'bg-[#FFF9E5]' : 'bg-transparent'}`}>
                <Icon 
                  className={`w-6 h-6 transition-colors duration-200 ${isActive ? 'text-[#C5A028] fill-[#C5A028]/20' : 'text-slate-400'}`} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
              </div>
              <span className={`text-[10px] font-bold tracking-wide transition-colors ${isActive ? 'text-[#C5A028]' : 'text-slate-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}