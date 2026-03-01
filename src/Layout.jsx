import React from 'react';
import { Link } from 'react-router-dom';
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
  HardDrive
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
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

  const navigation = isClient 
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

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Sidebar */}
      <aside className="fixed right-0 top-0 h-screen w-64 bg-[#000000] border-l border-[#D4AF37]/20 shadow-2xl">
        <div className="flex flex-col h-full">
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
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="mr-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}