import React, { useEffect, useState } from 'react';
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
  Shield,
  FileText,
  Camera,
  BookUser,
  UserCog,
  BarChart3
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
        { name: 'קבצים להורדה', icon: Folder, page: 'FileStorage' },
      ]
    : [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'ייבוא לידים', icon: Users, page: 'LeadImport' },
        { name: 'אנשי קשר', icon: BookUser, page: 'Contacts' },
        { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'ספקי משנה', icon: UserCog, page: 'SubVendors' },
        { name: 'אחסון קבצים', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
        { name: 'אנליטיקס', icon: BarChart3, page: 'Analytics' },
        ...(isAdmin ? [
          { name: 'משתמשים', icon: Shield, page: 'AdminUsers' },
          { name: 'מטריצת הרשאות', icon: Shield, page: 'RBACMatrix' },
        ] : []),
        { name: 'הגדרות', icon: SettingsIcon, page: 'Settings' },
      ];

  // Mobile Bottom Navigation Items (Fixed as requested: Dashboard, Leads, Projects, Settings)
  const mobileNavItems = isClient
    ? [
        { name: 'קבצים', icon: Folder, page: 'FileStorage' },
      ]
    : [
        { name: 'לוח', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'הגדרות', icon: SettingsIcon, page: 'Settings' },
      ];

  // Pages that should render without any nav
  const noLayoutPages = ['DownloadPage', 'QuoteView'];
  
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    
    // Security Directive: BOLA Protection & Route Segregation
    const protectedPages = ['Dashboard', 'Leads', 'Quotes', 'Projects', 'Tasks', 'AdminUsers', 'Settings', 'Contacts', 'SubVendors', 'Analytics', 'LeadImport', 'RBACMatrix'];
    
    if (isClient && protectedPages.includes(pageName)) {
      setAccessDenied(true);
      base44.functions.invoke('logSecurityIncident', { 
        path: location.pathname, 
        details: `Client role attempted to access restricted admin page: ${pageName}` 
      }).catch(console.error);
    } else if (isClient && !['FileStorage', 'DownloadPage', 'QuoteView', 'ClientGallery'].includes(pageName)) {
      window.location.href = createPageUrl('FileStorage');
    }
  }, [isClient, pageName, location.pathname]);

  if (accessDenied) {
    return (
      <div className="flex h-screen bg-[#050505] text-white items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-red-500/30 shadow-[0_0_30px_rgba(220,38,38,0.3)] max-w-md w-full">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">403 Access Denied</h1>
          <p className="text-white/60 mb-6">אין לך הרשאה לגשת לעמוד זה. ניסיון הגישה נרשם במערכת.</p>
          <p className="text-xs text-red-400/80 font-mono tracking-widest">SECURITY_INCIDENT_LOGGED</p>
        </div>
      </div>
    );
  }

  if (noLayoutPages.includes(pageName)) {
    return children;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-50 transition-colors duration-300" dir="rtl">
      
      {/* ── Mobile Header (Central Logo) ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-lg border-b border-white/10 z-40 flex items-center justify-center px-4 shadow-lg">
        {/* User Avatar (Left aligned in RTL) */}
        {user && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#b38f2d] flex items-center justify-center text-black font-bold text-sm shadow-[0_0_10px_rgba(255,215,0,0.3)]">
              {user.full_name?.[0] || '?'}
            </div>
          </div>
        )}
        
        {/* Central Logo */}
        <img 
          src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" 
          alt="KLIKLY" 
          className="h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" 
        />

        {/* Placeholder for right side balance or menu trigger if needed */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9"></div>
      </header>

      {/* ── Desktop Sidebar (Hidden on Mobile) ── */}
      <aside className="hidden md:flex flex-col w-72 bg-black text-white flex-shrink-0 h-full border-l border-white/5 transition-all duration-300">
        {/* Logo */}
        <div className="h-20 flex items-center justify-center px-8 border-b border-white/10 bg-black">
          <img 
            src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" 
            alt="KLIKLY" 
            className="h-14 object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]" 
          />
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
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
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
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
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
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-white text-black">
        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 md:pt-0 pb-24 md:pb-0 px-4 md:px-8 bg-white text-black">
          <div className="max-w-6xl mx-auto w-full py-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (Blurred & Luxury) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 z-50 flex items-stretch shadow-[0_-10px_30px_rgba(0,0,0,0.8)] px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        {mobileNavItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pageName === item.page;
          const isCenter = index === Math.floor(mobileNavItems.length / 2);
          
          if (isCenter) {
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className="flex-1 flex flex-col items-center justify-center -mt-6 active:scale-95 transition-transform duration-200"
              >
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#C5A028] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)] border-4 border-black">
                  <Camera className="w-6 h-6 text-black" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-[#FFD700] mt-1.5">
                  {item.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              to={createPageUrl(item.page)}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform duration-200"
            >
              <div className={`relative p-2 rounded-2xl transition-colors ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>
                <Icon 
                  className={`w-6 h-6 transition-colors duration-200 ${isActive ? 'text-[#FFD700]' : 'text-white/50'}`} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
              </div>
              <span className={`text-[10px] font-bold tracking-wide transition-colors ${isActive ? 'text-[#FFD700]' : 'text-white/50'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}