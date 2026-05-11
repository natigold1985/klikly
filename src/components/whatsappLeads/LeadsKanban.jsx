import React from 'react';
import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LEAD_STATUSES, STATUS_LABELS, STATUS_STYLES } from './statusConfig';

export default function LeadsKanban({ leads, onLeadClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" dir="rtl">
      {LEAD_STATUSES.map((status) => {
        const statusLeads = leads.filter((lead) => (lead.status || 'New Lead') === status);
        return (
          <section key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-h-96">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-slate-900">{STATUS_LABELS[status]}</h2>
              <Badge className={STATUS_STYLES[status]}>{statusLeads.length}</Badge>
            </div>
            <div className="space-y-3">
              {statusLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => onLeadClick(lead)}
                  className="w-full text-right rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{lead.first_name || 'ליד ללא שם'}</p>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <Phone className="w-4 h-4" /> {lead.phone_number}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-1 text-slate-600">{lead.source || '—'}</span>
                  </div>
                  {lead.full_name_notes && (
                    <p className="text-sm text-slate-600 mt-3 line-clamp-2">{lead.full_name_notes}</p>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}