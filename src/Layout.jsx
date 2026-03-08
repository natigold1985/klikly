import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
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
  Menu,
  X,
  Bell
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  const allNavigation = isClient 
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

  // Mobile Bottom Navigation Items (Limited to 4 + Menu)
  const mobileNavItems = isClient
    ? allNavigation.slice(0, 4)
    : [
        { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'לידים', icon: Users, page: 'Leads' },
        { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
        { name: 'הגדרות', icon: Settings, page: 'Settings' },
      ];

  const MobileHeader = () => (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-100 z-50 flex items-center justify-between px-4 shadow-sm">
      {/* Profile / Notifications Left */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-800">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[80vw] sm:w-[350px] p-0" dir="rtl">
             <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-xl font-bold text-[#D4AF37]">תפריט</h2>
                  <p className="text-sm text-white/50 mt-1">{user?.full_name}</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                  {allNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPageName === item.page;
                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.page)}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                          isActive 
                            ? 'bg-[#D4AF37] text-black font-bold' 
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
             </div>
          </SheetContent>
        </Sheet>
        
        <div className="relative">
           <Bell className="w-6 h-6 text-slate-800" />
           <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </div>
      </div>

      {/* Logo Right */}
      <div className="flex items-center gap-2">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-lg font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent">
            {settings?.business_name || 'Klikly'}
          </span>
        )}
      </div>
    </header>
  );

  const MobileBottomNav = () => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[safe-area-inset-bottom+64px] pb-[safe-area-inset-bottom] bg-white border-t border-slate-100 z-50 flex items-center justify-around px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPageName === item.page;
        return (
          <Link
            key={item.name}
            to={createPageUrl(item.page)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16 ${
              isActive ? 'text-[#C5A028]' : 'text-slate-400'
            }`}
          >
            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium truncate w-full text-center">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50/50" dir="rtl">
      
      {/* Mobile Elements */}
      <MobileHeader />
      <MobileBottomNav />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed right-0 top-0 h-screen w-64 bg-[#000000] border-l border-[#D4AF37]/20 shadow-2xl z-40 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#D4AF37]/20">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            {settings?.logo_url ? (
              <div className="w-20 h-20 rounded-full border-2 border-[#D4AF37]/20 overflow-hidden bg-black flex items-center justify-center">
                <img 
                  src={settings.logo_url} 
                  alt={settings?.business_name || 'Logo'} 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent mb-1">
                {settings?.business_name || 'Klikly'}
              </h1>
            )}
            
            {settings?.logo_url && settings?.business_name && (
              <h1 className="text-lg font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent">
                {settings.business_name}
              </h1>
            )}

            {!settings?.business_name && !settings?.logo_url && (
              <p className="text-xs text-[#808080]">ניהול לצלמים בקליק</p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {allNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black shadow-lg shadow-[#D4AF37]/30' 
                    : 'text-[#808080] hover:bg-[#0D0D0D] hover:text-white'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-[#808080]'}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-[#D4AF37]/20">
          <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-center">
            <p className="text-sm font-bold text-black">
              {user?.full_name || 'משתמש'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:mr-64 min-h-screen pt-20 pb-24 md:pt-0 md:pb-0 transition-all duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}