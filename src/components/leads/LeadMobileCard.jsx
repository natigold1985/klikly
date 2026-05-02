import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2, Zap, ChevronLeft } from 'lucide-react';
import SourceBadge from './SourceBadge';
import StatusSelect from './StatusSelect';
import PaymentStatusRow from './PaymentStatusRow';

const getWhatsAppLink = (lead) => {
  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
  const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
  const hasRealName = lead.name && !['לא ידוע', 'unknown', 'Unknown'].includes(lead.name.trim());
  const msg = hasRealName
    ? `היי ${lead.name}, אני צלם/ת מקצועי/ת ושמחתי לראות שהתעניינת. אשמח לספר לך על השירותים שלי ולתאם שיחה קצרה. מה אומר/ת?`
    : `הי, האם עדיין רלוונטי עבורכם שירותי צילום?`;
  return `https://wa.me/${israelPhone}?text=${encodeURIComponent(msg)}`;
};

// Hide noisy/empty source values
const isMeaningfulSource = (src) => {
  if (!src) return false;
  const v = String(src).trim().toLowerCase();
  return v && !['לא ידוע', 'unknown', 'none', '-', 'n/a'].includes(v);
};

export default function LeadMobileCard({ lead, onStatusChange, onDelete, onAutoFollowUp, project }) {
  const showSource = isMeaningfulSource(lead.source);
  const isClosedWon = lead.status === 'closed_won';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 active:scale-[0.99] transition-transform overflow-hidden">
      {/* Top: name + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          to={createPageUrl(`LeadDetails?id=${lead.id}`)}
          className="flex items-center gap-1 min-w-0 flex-1"
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-base leading-tight break-words line-clamp-2">
              {lead.name}
            </h3>
            {lead.shooting_type && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{lead.shooting_type}</p>
            )}
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </Link>
        <div className="flex-shrink-0">
          <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
        </div>
      </div>

      {/* Phone + source on the same line, source only when meaningful */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100 min-w-0">
        <a
          href={`tel:${lead.phone}`}
          className="font-mono text-sm text-slate-700 hover:text-blue-600 transition-colors truncate flex-shrink min-w-0"
          dir="ltr"
        >
          {lead.phone}
        </a>
        {showSource && (
          <div className="flex-shrink-0 max-w-[55%]">
            <SourceBadge source={lead.source} />
          </div>
        )}
      </div>

      {/* Payment status — only for closed_won leads with a linked project */}
      {isClosedWon && project && (
        <div className="mb-3">
          <PaymentStatusRow project={project} />
        </div>
      )}

      {/* Actions row */}
      <div className="grid grid-cols-4 gap-2">
        <a
          href={getWhatsAppLink(lead)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95 transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold">וואטסאפ</span>
        </a>
        <a
          href={`tel:${lead.phone}`}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-sm active:scale-95 transition-all"
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