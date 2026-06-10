import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2, Zap, Pencil, Undo2, ExternalLink, Sparkles } from 'lucide-react';
import SourceBadge from './SourceBadge';
import LeadContextBadge from './LeadContextBadge';
import StatusSelect from './StatusSelect';
import LeadMobileCard from './LeadMobileCard';
import { normalizeIsraeliPhone, getIsraeliWhatsAppPhone } from '@/utils/leadDisplay';

export default function LeadTableView({ leads, onStatusChange, onDelete, onAutoFollowUp, onRestoreToActive, projectsByLeadId = {} }) {
  const getWhatsAppLink = (lead) => {
    const israelPhone = getIsraeliWhatsAppPhone(lead.phone);
    const name = (lead.name || '').trim();
    const hasRealName = name && !['לא ידוע', 'unknown', 'Unknown', '—', '-'].includes(name);
    const leadType = lead.lead_type || lead.interest_label || lead.shooting_type || 'שירותי צילום';
    const msg = hasRealName
      ? `היי ${name}, מה קורה? ראיתי שהשארת פרטים לגבי ${leadType}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`
      : `היי, מה קורה? ראיתי שהשארת פרטים לגבי ${leadType}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`;
    if (!israelPhone) return '#';
    return `https://web.whatsapp.com/send?phone=${israelPhone}&text=${encodeURIComponent(msg)}`;
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
            onRestoreToActive={onRestoreToActive}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/60 overflow-x-auto overflow-y-hidden">
      <table className="min-w-[1100px] w-full text-sm table-fixed" dir="rtl">
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
          <col className="w-[13%]" />
          <col className="w-[17%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="bg-gradient-to-l from-[#FFD700] via-[#F6C400] to-[#E5B800] text-black shadow-sm sticky top-0 z-10">
            <th className="text-right py-3 px-4 font-bold tracking-wide">שם</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide">מקור</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide whitespace-nowrap">טלפון</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide">סטטוס</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide whitespace-nowrap">תאריך הוספת הליד</th>
            <th className="text-right py-3 px-4 font-bold tracking-wide">הערות</th>
            <th className="text-center py-3 px-4 font-bold tracking-wide">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => {
            // If phone is invalid (too long / not a real phone), move it into notes display and clear the phone cell
            const rawPhone = (lead.phone || '').toString();
            const displayPhone = normalizeIsraeliPhone(rawPhone);
            const digits = displayPhone.replace(/[^0-9]/g, '');
            const isValidPhone = digits.length >= 7 && digits.length <= 15;
            const extraNote = !isValidPhone && rawPhone ? `טלפון שגוי: ${rawPhone}` : '';
            const combinedNotes = [extraNote, lead.notes].filter(Boolean).join(' • ');

            return (
            <tr
              key={lead.id}
              className={`border-b border-slate-100 last:border-0 transition-colors ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
              } hover:bg-[#FFFBEA]`}
            >
              <td className="py-3 px-4 max-w-0">
                <Link
                  to={createPageUrl(`LeadDetails?id=${lead.id}`)}
                  className="font-black text-slate-900 hover:text-[#B8860B] transition-colors block truncate text-[15px]"
                  title={lead.name}
                >
                  {lead.name || '—'}
                </Link>
                {lead.email && <p className="text-xs text-slate-400 mt-0.5 truncate" dir="ltr" title={lead.email}>{lead.email}</p>}
                <LeadContextBadge lead={lead} />
              </td>

              <td className="py-3 px-4">
                <SourceBadge source={lead.source} />
              </td>

              <td className="py-3 px-4">
                {displayPhone ? (
                  <a href={`tel:${displayPhone}`} className="inline-flex items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100 tracking-wide select-text whitespace-nowrap ring-1 ring-blue-100" dir="ltr" title={displayPhone}>
                    {displayPhone}
                  </a>
                ) : (
                  <span className="text-slate-300 text-sm">—</span>
                )}
              </td>

              <td className="py-3 px-4 min-w-[130px]">
                <div className="rounded-2xl bg-white p-1 ring-1 ring-slate-200 shadow-sm w-fit">
                  <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
                </div>
              </td>

              <td className="py-3 px-4 min-w-[110px]">
                <span className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 whitespace-nowrap">
                  {lead.created_date ? new Date(lead.created_date).toLocaleDateString('he-IL') : '—'}
                </span>
              </td>

              <td className="py-3 px-4">
                <p className="text-xs text-slate-600 leading-relaxed select-text whitespace-normal break-words line-clamp-3" title={combinedNotes}>
                  {combinedNotes || <span className="text-slate-300">—</span>}
                </p>
              </td>

              {/* CTA pills — always visible, compact */}
              <td className="py-3 px-3">
                <div className="flex items-center justify-center gap-2 flex-nowrap">
                  <Link
                    to={createPageUrl(`LeadDetails?id=${lead.id}`)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm hover:shadow transition-all active:scale-95"
                    title="עריכה"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  {lead.source_post_url && (
                    <a
                      href={lead.source_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                      title="פתח פוסט מקורי"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {getIsraeliWhatsAppPhone(lead.phone) && (
                    <a
                      href={getWhatsAppLink(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                      title="וואטסאפ"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                  <a
                    href={`tel:${displayPhone}`}
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
                          ? 'bg-[#FFD700] text-black hover:bg-[#E5B800] ring-2 ring-[#FFD700]/30'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={lead.auto_followup_enabled ? 'פולו-אפ אוטומטי פעיל - לחץ לעריכה' : 'הפעל פולו-אפ אוטומטי'}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  {onRestoreToActive && lead.is_filtered && (
                    <button
                      onClick={() => onRestoreToActive(lead.id)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-purple-500 hover:bg-purple-600 text-white shadow-sm hover:shadow transition-all active:scale-95"
                      title="החזר לליד פעיל"
                    >
                      <Undo2 className="w-4 h-4" />
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
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}