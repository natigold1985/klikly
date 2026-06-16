import React from 'react';
import { FolderOpen, HardDrive, CalendarCheck, Users } from 'lucide-react';

export default function StorageOverviewStats({ projects }) {
  const total = projects.length;
  const connected = projects.filter((project) => !!project.drive_folder_url).length;
  const scheduled = projects.filter((project) => !!project.shooting_date).length;
  const clients = new Set(projects.map((project) => project.client_email).filter(Boolean)).size;

  const items = [
    { label: 'אירועים', value: total, icon: CalendarCheck, accent: 'bg-[#FFD700]/15 text-[#9A7400]' },
    { label: 'תיקיות Drive', value: connected, icon: HardDrive, accent: 'bg-blue-50 text-blue-700' },
    { label: 'עם תאריך צילום', value: scheduled, icon: FolderOpen, accent: 'bg-emerald-50 text-emerald-700' },
    { label: 'לקוחות', value: clients, icon: Users, accent: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, accent }) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="text-2xl font-black text-slate-950 mt-1">{value}</p>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${accent}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}