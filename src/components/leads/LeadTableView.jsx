import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SourceBadge from './SourceBadge';
import StatusSelect from './StatusSelect';

export default function LeadTableView({ leads, onStatusChange, onDelete }) {
  const getWhatsAppLink = (lead) => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const msg = `היי ${lead.name}, אני צלם/ת מקצועי/ת ושמחתי לראות שהתעניינת. אשמח לספר לך על השירותים שלי ולתאם שיחה קצרה. מה אומר/ת?`;
    return `https://wa.me/${israelPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-right py-3 px-4 font-semibold text-slate-600">שם</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">טלפון</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600 hidden md:table-cell">מקור</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600 hidden md:table-cell">נוצר</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">סטטוס</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600 hidden lg:table-cell">סוג צילום</th>
            <th className="text-center py-3 px-4 font-semibold text-slate-600 w-40">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
            const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
            return (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-4">
                  <Link to={createPageUrl(`LeadDetails?id=${lead.id}`)} className="font-semibold text-slate-900 hover:text-[#D4AF37] transition-colors">
                    {lead.name}
                  </Link>
                  {lead.email && <p className="text-xs text-slate-400 mt-0.5">{lead.email}</p>}
                </td>
                <td className="py-3 px-4 font-mono text-slate-600 text-xs">{lead.phone}</td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <SourceBadge source={lead.source} />
                </td>
                <td className="py-3 px-4 hidden md:table-cell text-slate-500 text-xs whitespace-nowrap">
                  {lead.created_date ? new Date(lead.created_date).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="py-3 px-4">
                  <StatusSelect value={lead.status} onChange={(val) => onStatusChange(lead.id, val)} />
                </td>
                <td className="py-3 px-4 hidden lg:table-cell text-slate-500 text-xs">{lead.shooting_type || '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    <a href={getWhatsAppLink(lead)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" title="מענה מהיר בוואטסאפ">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </a>
                    <a href={`tel:${lead.phone}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => onDelete(lead.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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