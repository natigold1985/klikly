import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  FileText, 
  CheckSquare, 
  Settings,
  Camera
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const navigation = [
    { name: 'לוח ניהול', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'לידים', icon: Users, page: 'Leads' },
    { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
    { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
    { name: 'משימות', icon: CheckSquare, page: 'Tasks' },
    { name: 'External Cloud', icon: Camera, page: 'CloudStorage' },
    { name: 'הגדרות', icon: Settings, page: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#000000]" dir="rtl">
      {/* Sidebar */}
      <aside className="fixed right-0 top-0 h-screen w-64 bg-[#000000] border-l border-[#D4AF37]/20 shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-[#D4AF37]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#C5A028] flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
                <Camera className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent">
                  Klikly
                </h1>
                <p className="text-xs text-[#808080]">ניהול לצלמים בקליק</p>
              </div>
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
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0D0D0D] border border-[#D4AF37]/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#C5A028] flex items-center justify-center text-black font-bold text-sm">
                צ
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">צלם מקצועי</p>
                <p className="text-xs text-[#808080]">תוכנית חודשית</p>
              </div>
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