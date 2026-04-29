import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2 } from 'lucide-react';
import SourceBadge from './SourceBadge';
import StatusSelect from './StatusSelect';

// Deterministic avatar color from a string (name/email)
const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];
const colorFor = (s = '') => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

export default function LeadTableView({ leads, onStatusChange, onDelete }) {
  const getWhatsAppLink = (lead) => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const msg = `היי ${lead.name}, אני צלם/ת מקצועי/ת ושמחתי לראות שהתעניינת. אשמח לספר לך על השירותים שלי ולתאם שיחה קצרה. מה אומר/ת?`;
    return `https://wa.me/${israelPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="bg-gradient-to-l from-[#FFD700] to-[#E5B800] text-black">
            <th className="text-right py-4 px-5 font-bold tracking-wide">שם</th>
            <th className="text-right py-4 px-5 font-bold tracking-wide hidden md:table-cell">מקור</th>
            <th className="text-right py-4 px-5 font-bold tracking-wide">טלפון</th>
            <th className="text-right py-4 px-5 font-bold tracking-wide">סטטוס</th>
            <th className="text-right py-4 px-5 font-bold tracking-wide hidden lg:table-cell">סוג צילום</th>
            <th className="text-right py-4 px-5 font-bold tracking-wide hidden md:table-cell">נוצר</th>
            <th className="text-center py-4 px-5 font-bold tracking-wide w-[280px]">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => {
            const initial = (lead.name || '?').trim().charAt(0).toUpperCase();
            const avatarColor = colorFor(lead.email || lead.name || '');
            return (
              <tr
                key={lead.id}
                className={`border-b border-slate-100 last:border-0 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                } hover:bg-[#FFFBEA]`}
              >
                {/* Name + avatar + source label */}
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${avatarColor} text-white font-bold flex items-center justify-center shadow-sm shrink-0`}>
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={createPageUrl(`LeadDetails?id=${lead.id}`)}
                        className="font-bold text-slate-900 hover:text-[#B8860B] transition-colors block truncate"
                      >
                        {lead.name}
                      </Link>
                      {lead.source && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{lead.source}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Source badge */}
                <td className="py-4 px-5 hidden md:table-cell">
                  <SourceBadge source={lead.source} />
                </td>

                {/* Phone */}
                <td className="py-4 px-5 font-mono text-slate-700 whitespace-nowrap">
                  {lead.phone}
                </td>

                {/* Status */}
                <td className="py-4 px-5">
                  <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
                </td>

                {/* Shooting type */}
                <td className="py-4 px-5 hidden lg:table-cell text-slate-600">
                  {lead.shooting_type || '—'}
                </td>

                {/* Created */}
                <td className="py-4 px-5 hidden md:table-cell text-slate-500 text-xs whitespace-nowrap">
                  {lead.created_date
                    ? new Date(lead.created_date).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </td>

                {/* CTA pills */}
                <td className="py-4 px-5">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <a
                      href={getWhatsAppLink(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
                      title="וואטסאפ"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
                      title="חיוג"
                    >
                      <Phone className="w-4 h-4" />
                      <span>חיוג</span>
                    </a>
                    <button
                      onClick={() => onDelete(lead.id)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                      title="מחיקה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}