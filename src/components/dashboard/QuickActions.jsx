import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, FileText, FolderPlus, Send, Zap } from 'lucide-react';

const ACTIONS = [
  { label: 'ליד חדש', icon: UserPlus, link: 'Leads', color: 'from-blue-500 to-blue-600' },
  { label: 'הצעת מחיר', icon: FileText, link: 'Quotes', color: 'from-purple-500 to-purple-600' },
  { label: 'פרויקט חדש', icon: FolderPlus, link: 'Projects', color: 'from-emerald-500 to-emerald-600' },
  { label: 'שלח קבצים', icon: Send, link: 'FileStorage', color: 'from-amber-500 to-amber-600' },
];

export default function QuickActions() {
  return (
    <Card className="border rounded-2xl">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#C5A028]" />
          <h3 className="text-sm font-bold text-slate-800">פעולות מהירות</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={createPageUrl(a.link)}>
                <div className={`bg-gradient-to-br ${a.color} text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.97] transition-transform shadow-sm cursor-pointer min-h-[88px]`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-semibold text-center">{a.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}