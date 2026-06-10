import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2, Zap, ChevronLeft, Undo2 } from 'lucide-react';
import SourceBadge from './SourceBadge';
import LeadContextBadge from './LeadContextBadge';
import StatusSelect from './StatusSelect';
import PaymentStatusRow from './PaymentStatusRow';
import { normalizeIsraeliPhone, getIsraeliWhatsAppPhone } from '@/utils/leadDisplay';

const getWhatsAppLink = (lead) => {
  const israelPhone = getIsraeliWhatsAppPhone(lead.phone);
  const hasRealName = lead.name && !['לא ידוע', 'unknown', 'Unknown'].includes(lead.name.trim());
  const leadType = lead.lead_type || lead.interest_label || lead.shooting_type || 'שירותי צילום';
  const msg = hasRealName
    ? `היי ${lead.name}, מה קורה? ראיתי שהשארת פרטים לגבי ${leadType}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`
    : `היי, מה קורה? ראיתי שהשארת פרטים לגבי ${leadType}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`;
  return `https://wa.me/${israelPhone}?text=${encodeURIComponent(msg)}`;
};

// Hide noisy/empty source values
const isMeaningfulSource = (src) => {
  if (!src) return false;
  const v = String(src).trim().toLowerCase();
  return v && !['לא ידוע', 'unknown', 'none', '-', 'n/a'].includes(v);
};

export default function LeadMobileCard({ lead, onStatusChange, onDelete, onAutoFollowUp, onRestoreToActive, project }) {
  const showSource = isMeaningfulSource(lead.source);
  const isClosedWon = lead.status === 'closed_won';
  const displayName = lead.name || 'ללא שם';

  // Validate phone: if invalid (too long / non-standard), move it to notes
  const rawPhone = (lead.phone || '').toString();
  const displayPhone = normalizeIsraeliPhone(rawPhone);
  const digits = displayPhone.replace(/[^0-9]/g, '');
  const isValidPhone = digits.length >= 7 && digits.length <= 15;
  const extraNote = !isValidPhone && rawPhone ? `טלפון שגוי: ${rawPhone}` : '';
  const combinedNotes = [extraNote, lead.notes].filter(Boolean).join(' • ');

  return (
    <div className="bg-white rounded-[1.75rem] border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-4 active:scale-[0.99] transition-transform overflow-hidden ring-1 ring-slate-100">
      {/* Top row: name (truncated) — full width */}
      <Link
        to={createPageUrl(`LeadDetails?id=${lead.id}`)}
        className="flex items-center gap-1 mb-2"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
            {displayName}
          </h3>
          <LeadContextBadge lead={lead} />
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </Link>

      {/* Status row — own row, prevents overlap with long names */}
      <div className={`grid gap-2 mb-3 ${showSource ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="rounded-2xl bg-amber-50 p-1.5 ring-1 ring-amber-100">
          <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
        </div>
        {showSource && (
          <div className="flex items-center justify-center rounded-2xl bg-slate-50 px-2 ring-1 ring-slate-200 min-w-0">
            <SourceBadge source={lead.source} />
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100 min-w-0">
        {displayPhone ? (
          <a
            href={`tel:${displayPhone}`}
            className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100 transition-colors truncate min-w-0 tracking-wide ring-1 ring-blue-100"
            dir="ltr"
          >
            {displayPhone}
          </a>
        ) : (
          <span className="text-sm text-slate-400">אין טלפון תקין</span>
        )}
      </div>

      {/* Notes (includes invalid phone if relevant) */}
      {combinedNotes && (
        <div className="mb-3 pb-3 border-b border-slate-100">
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={combinedNotes}>
            {combinedNotes}
          </p>
        </div>
      )}

      {/* Payment status — only for closed_won leads with a linked project */}
      {isClosedWon && project && (
        <div className="mb-3">
          <PaymentStatusRow project={project} />
        </div>
      )}

      {/* Restore to active — only for filtered leads */}
      {onRestoreToActive && lead.is_filtered && (
        <button
          onClick={() => onRestoreToActive(lead.id)}
          className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white shadow-sm active:scale-95 transition-all"
        >
          <Undo2 className="w-4 h-4" />
          <span className="text-xs font-bold">החזר לליד פעיל</span>
        </button>
      )}

      {/* Actions row */}
      <div className="grid grid-cols-4 gap-2">
        <a
          href={displayPhone ? getWhatsAppLink(lead) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all ${displayPhone ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold">וואטסאפ</span>
        </a>
        <a
          href={displayPhone ? `tel:${displayPhone}` : undefined}
          className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all ${displayPhone ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}
        >
          <Phone className="w-5 h-5" />
          <span className="text-[10px] font-bold">חיוג</span>
        </a>
        {onAutoFollowUp && (
          <button
            onClick={() => onAutoFollowUp(lead)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all ${
              lead.auto_followup_enabled
                ? 'bg-[#FFD700] text-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span className="text-[10px] font-bold">פולו-אפ</span>
          </button>
        )}
        <button
          onClick={() => onDelete(lead.id)}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 active:scale-95 transition-all"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">מחיקה</span>
        </button>
      </div>
    </div>
  );
}