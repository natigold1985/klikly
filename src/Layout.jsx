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
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'לידים', icon: Users, page: 'Leads' },
    { name: 'פרויקטים', icon: Briefcase, page: 'Projects' },
    { name: 'הצעות מחיר', icon: FileText, page: 'Quotes' },
    { name: 'משימות', icon: CheckSquare, page: 'Tasks' },
    { name: 'הגדרות', icon: Settings, page: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" dir="rtl">
      {/* Sidebar */}
      <aside className="fixed right-0 top-0 h-screen w-64 bg-white/40 backdrop-blur-xl border-l border-white/20 shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  BASE 44
                </h1>
                <p className="text-xs text-slate-500">מערכת ניהול לצלמים</p>
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
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' 
                      : 'text-slate-600 hover:bg-white/60 hover:shadow-md'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-white/20">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                צ
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">צלם מקצועי</p>
                <p className="text-xs text-slate-500">תוכנית חודשית</p>
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