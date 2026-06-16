import React from 'react';
import { CalendarCheck, Users, Clock } from 'lucide-react';

export default function CalendarStats({ events }) {
  const upcoming = events.filter((event) => new Date(event.date) >= new Date(new Date().toDateString())).length;
  const clients = new Set(events.map((event) => event.email || event.phone || event.name).filter(Boolean)).size;
  const stats = [
    { label: 'אירועים ביומן', value: events.length, icon: CalendarCheck, className: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'לקוחות שונים', value: clients, icon: Users, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'אירועים עתידיים', value: upcoming, icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-100' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={`rounded-2xl border p-4 shadow-sm ${stat.className}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium opacity-80">{stat.label}</p>
                <p className="text-3xl font-black mt-1">{stat.value}</p>
              </div>
              <Icon className="w-8 h-8 opacity-80" />
            </div>
          </div>
        );
      })}
    </div>
  );
}