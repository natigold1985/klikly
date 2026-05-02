import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import Footer from '@/components/Footer';
import AccessibilityWidget from '@/components/AccessibilityWidget';
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
  BookUser,
  UserCog,
  BarChart3,
  X,
  LogOut
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const pageName = currentPageName || location.pathname.split('/').pop() || 'Home';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        ...(isAdmin ? [{ name: 'ייבוא לידים', icon: Users, page: 'LeadImport' }] : []),
        { name: 'אנשי קשר', icon: BookUser, page: 'Contacts' },
        { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
        { name: 'תבניות הצעות', icon: FileText, page: 'QuoteTemplates' },
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

  // Mobile Bottom Navigation Items
  const mobileNavItems = isClient
    ? [
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'גלריה', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
      ]
    : [
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'אחסון', icon: Folder, page: 'FileStorage' },
        { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
      ];

  // Pages that should render without any nav
  const noLayoutPages = ['DownloadPage', 'QuoteView'];
  
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    
    // Security Directive: BOLA Protection & Route Segregation
    const protectedPages = ['AdminUsers', 'Settings', 'LeadImport', 'RBACMatrix'];
    
    if (isClient && protectedPages.includes(pageName)) {
      setAccessDenied(true);
      base44.functions.invoke('logSecurityIncident', { 
        path: location.pathname, 
        details: `Client role attempted to access restricted admin page: ${pageName}` 
      }).catch(console.error);
    } else {
      setAccessDenied(false);
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

  // ── Client view: sidebar with options + main content
  if (isClient) {
    const clientNav = [
      { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
      { name: 'לידים', icon: Users, page: 'Leads' },
      { name: 'אנשי קשר', icon: BookUser, page: 'Contacts' },
      { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
      { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
      { name: 'ספקי משנה', icon: UserCog, page: 'SubVendors' },
      { name: 'הגלריה שלי', icon: Folder, page: 'FileStorage' },
      { name: 'משימות', icon: CheckCircle2, page: 'Tasks' },
      { name: 'אנליטיקס', icon: BarChart3, page: 'Analytics' },
    ];

    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900" dir="rtl">
        {/* Mobile Header */}
        <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-lg border-b border-white/10 z-40 flex items-center justify-center px-4 shadow-lg">
          {user && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#b38f2d] flex items-center justify-center text-black font-bold text-sm shadow-[0_0_10px_rgba(255,215,0,0.3)]">
                {user.full_name?.[0] || '?'}
              </div>
            </div>
          )}
          <img
            src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png"
            alt="KLIKLY"
            className="h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={() => base44.auth.logout()}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-colors"
              title="התנתקות"
            >
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>

        {/* Mobile Drawer Menu (Client) */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-black border-l border-white/10 shadow-2xl flex flex-col">
              <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
                <span className="text-white font-bold text-sm">תפריט</span>
                <button onClick={() => setMobileMenuOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {clientNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pageName === item.page;
                  return (
                    <Link
                      key={item.name}
                      to={createPageUrl(item.page)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black font-bold'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-white/50'}`} />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-72 bg-black text-white flex-shrink-0 h-full border-l border-white/5">
          <div className="h-20 flex items-center justify-center px-8 border-b border-white/10 bg-black">
            <img
              src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png"
              alt="KLIKLY"
              className="h-14 object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]"
            />
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {clientNav.map((item) => {
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
          {user && (
            <div className="p-6 border-t border-white/10 bg-[#050505] space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#b38f2d] flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {user.full_name?.[0] || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                  <p className="text-xs text-white/40 truncate">לקוח</p>
                </div>
              </div>
              <button
                onClick={() => base44.auth.logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                התנתקות
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-white">
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 md:pt-0 pb-24 md:pb-0 px-4 md:px-8">
            <div className="max-w-6xl mx-auto w-full py-6">
              {children}
            </div>
            <Footer />
          </main>
        </div>
        <AccessibilityWidget />

        {/* Mobile Bottom Navigation (Client) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 z-50 flex items-stretch shadow-[0_-10px_30px_rgba(0,0,0,0.8)] px-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(72px + env(safe-area-inset-bottom))' }}
        >
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className="flex-1 flex flex-col items-center justify-center gap-1.5"
              >
                <div className={`p-2 rounded-2xl ${isActive ? 'bg-white/10' : ''}`}>
                  <Icon className={`w-6 h-6 ${isActive ? 'text-[#FFD700]' : 'text-white/50'}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-[#FFD700]' : 'text-white/50'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
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

        {/* Right Side: Logout + Hamburger */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            onClick={() => base44.auth.logout()}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-colors"
            title="התנתקות"
          >
            <LogOut className="w-5 h-5 text-red-400" />
          </button>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-black border-l border-white/10 shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
              <span className="text-white font-bold text-sm">תפריט</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {sidebarNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pageName === item.page;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black font-bold'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-white/50'}`} />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            {user && (
              <div className="p-4 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#b38f2d] flex items-center justify-center text-white font-bold text-sm">
                    {user.full_name?.[0] || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                    <p className="text-xs text-white/40 truncate">{isAdmin ? 'מנהל' : 'משתמש'}</p>
                  </div>
                </div>
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white border border-red-400 shadow-lg shadow-red-500/30 transition-all text-sm font-bold"
                >
                  <LogOut className="w-5 h-5" />
                  התנתקות
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="p-6 border-t border-white/10 bg-[#050505] space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#b38f2d] flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user.full_name?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-xs text-white/40 truncate">{isAdmin ? 'מנהל מערכת' : 'לקוח'}</p>
              </div>
            </div>
            <button
              onClick={() => base44.auth.logout()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              התנתקות
            </button>
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
          <Footer />
        </main>
      </div>

      {/* ── Accessibility Widget ── */}
      <AccessibilityWidget />

      {/* ── PWA Install Banner ── */}
      <PWAInstallBanner />

      {/* ── Mobile Bottom Navigation Bar (Blurred & Luxury) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 z-50 flex items-stretch shadow-[0_-10px_30px_rgba(0,0,0,0.8)] px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pageName === item.page;
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