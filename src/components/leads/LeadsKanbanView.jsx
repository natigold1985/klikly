import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle } from 'lucide-react';
import SourceBadge from './SourceBadge';
import StatusSelect from './StatusSelect';
import { STATUS_STYLES } from '@/utils/leadDisplay';

const COLUMNS = ['new', 'in_progress', 'follow_up', 'quote_sent', 'closed_won', 'closed_lost'];

export default function LeadsKanbanView({ leads, onStatusChange }) {
  return (
    <div className="overflow-x-auto pb-3" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 min-w-full">
        {COLUMNS.map((status) => {
          const config = STATUS_STYLES[status];
          const items = leads.filter((lead) => lead.status === status);

          return (
            <div key={status} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 min-h-64">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                  <h3 className="text-sm font-black text-slate-800">{config.label}</h3>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{items.length}</span>
              </div>

              <div className="space-y-3">
                {items.map((lead) => (
                  <div key={lead.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow">
                    <Link to={createPageUrl(`LeadDetails?id=${lead.id}`)} className="block">
                      <p className="font-black text-slate-900 truncate">{lead.name || 'ללא שם'}</p>
                      {lead.interest_label && <p className="text-xs text-[#9A7500] font-bold mt-1 truncate">{lead.interest_label}</p>}
                    </Link>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <SourceBadge source={lead.source} />
                      <StatusSelect value={lead.status} onChange={(value) => onStatusChange(lead.id, value)} compact />
                    </div>
                    {lead.notes && <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">{lead.notes}</p>}
                    <div className="flex gap-2 mt-3">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-50 text-blue-700 py-2 text-xs font-bold">
                          <Phone className="w-3.5 h-3.5" /> חיוג
                        </a>
                      )}
                      {lead.phone && (
                        <a href={`https://wa.me/${String(lead.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 text-emerald-700 py-2 text-xs font-bold">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}