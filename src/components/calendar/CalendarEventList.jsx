import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Mail, Phone, ExternalLink } from 'lucide-react';

export default function CalendarEventList({ events }) {
  if (!events.length) return <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center text-slate-500">אין אירועים להצגה בחודש הזה.</div>;

  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100"><h2 className="text-xl font-black">אירועי החודש</h2></div>
      <div className="divide-y divide-slate-100">
        {events.map((event) => (
          <Link key={event.id} to={`/LeadDetails?id=${event.id}`} className="block p-5 hover:bg-slate-50 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{event.name || 'לקוח ללא שם'}</p>
                <p className="text-sm text-slate-500 mt-1">{event.shooting_type || event.lead_type || 'סוג צילום לא הוגדר'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-3 py-1 font-bold"><Calendar className="w-4 h-4" />{event.dateLabel}</span>
                {event.phone && <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" />{event.phone}</span>}
                {event.email && <span className="inline-flex items-center gap-1"><Mail className="w-4 h-4" />{event.email}</span>}
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}