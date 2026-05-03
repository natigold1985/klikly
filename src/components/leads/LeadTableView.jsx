import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2, Zap, Pencil } from 'lucide-react';
import SourceBadge from './SourceBadge';
import StatusSelect from './StatusSelect';
import LeadMobileCard from './LeadMobileCard';

export default function LeadTableView({ leads, onStatusChange, onDelete, onAutoFollowUp, projectsByLeadId = {} }) {
  const getWhatsAppLink = (lead) => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const hasRealName = lead.name && !['לא ידוע', 'unknown', 'Unknown'].includes(lead.name.trim());
    const msg = hasRealName
      ? `היי ${lead.name}, אני צלם/ת מקצועי/ת ושמחתי לראות שהתעניינת. אשמח לספר לך על השירותים שלי ולתאם שיחה קצרה. מה אומר/ת?`
      : `הי, האם עדיין רלוונטי עבורכם שירותי צילום?`;
    return `https://wa.me/${israelPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-3" dir="rtl">
        {leads.map((lead) => (
          <LeadMobileCard
            key={lead.id}
            lead={lead}
            project={projectsByLeadId[lead.id]}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onAutoFollowUp={onAutoFollowUp}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm table-fixed" dir="rtl">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[14%] hidden md:table-column" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[28%]" />
        </colgroup>
        <thead>
          <tr className="bg-gradient-to-l from-[#FFD700] to-[#E5B800] text-black">
            <th className="text-right py-3 px-4 font-bold tracking-wide">שם</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide hidden md:table-cell">מקור</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide whitespace-nowrap">טלפון</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide">סטטוס</th>
            <th className="text-center py-3 px-4 font-bold tracking-wide">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => (
            <tr
              key={lead.id}
              className={`border-b border-slate-100 last:border-0 transition-colors ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
              } hover:bg-[#FFFBEA]`}
            >
              <td className="py-3 px-4">
                <Link
                  to={createPageUrl(`LeadDetails?id=${lead.id}`)}
                  className="font-bold text-slate-900 hover:text-[#B8860B] transition-colors block truncate"
                >
                  {lead.name}
                </Link>
                {lead.shooting_type && <p className="text-xs text-slate-400 mt-0.5 truncate">{lead.shooting_type}</p>}
              </td>

              <td className="py-3 px-4 hidden md:table-cell">
                <SourceBadge source={lead.source} />
              </td>

              <td className="py-3 px-4 whitespace-nowrap">
                <a href={`tel:${lead.phone}`} className="text-sm font-bold text-slate-900 hover:text-blue-600 tracking-wide" dir="ltr">
                  {lead.phone}
                </a>
              </td>

              <td className="py-3 px-4">
                <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
              </td>

              {/* CTA pills — always visible, compact */}
              <td className="py-3 px-3">
                <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                  <Link
                    to={createPageUrl(`LeadDetails?id=${lead.id}`)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm hover:shadow transition-all active:scale-95"
                    title="עריכה"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <a
                    href={getWhatsAppLink(lead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                    title="וואטסאפ"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                    title="חיוג"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  {onAutoFollowUp && (
                    <button
                      onClick={() => onAutoFollowUp(lead)}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full shadow-sm hover:shadow transition-all active:scale-95 ${
                        lead.auto_followup_enabled
                          ? 'bg-[#FFD700] text-black hover:bg-[#E5B800]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={lead.auto_followup_enabled ? 'פולו-אפ אוטומטי פעיל' : 'הפעל פולו-אפ אוטומטי'}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
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
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}