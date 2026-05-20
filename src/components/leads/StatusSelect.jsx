import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_STYLES, normalizeLeadStatus } from '@/utils/leadDisplay';

const STATUS_OPTIONS = [
  { value: 'ליד חדש', label: STATUS_STYLES['ליד חדש'].label, color: STATUS_STYLES['ליד חדש'].dot, pill: STATUS_STYLES['ליד חדש'].pill },
  { value: 'נוצר קשר', label: STATUS_STYLES['נוצר קשר'].label, color: STATUS_STYLES['נוצר קשר'].dot, pill: STATUS_STYLES['נוצר קשר'].pill },
  { value: 'נשלח פולו-אפ', label: STATUS_STYLES['נשלח פולו-אפ'].label, color: STATUS_STYLES['נשלח פולו-אפ'].dot, pill: STATUS_STYLES['נשלח פולו-אפ'].pill },
  { value: 'נענה', label: STATUS_STYLES['נענה'].label, color: STATUS_STYLES['נענה'].dot, pill: STATUS_STYLES['נענה'].pill },
  { value: 'נסגר בהצלחה', label: STATUS_STYLES['נסגר בהצלחה'].label, color: STATUS_STYLES['נסגר בהצלחה'].dot, pill: STATUS_STYLES['נסגר בהצלחה'].pill },
  { value: 'לא רלוונטי', label: STATUS_STYLES['לא רלוונטי'].label, color: STATUS_STYLES['לא רלוונטי'].dot, pill: STATUS_STYLES['לא רלוונטי'].pill },
];

export default function StatusSelect({ value, onChange, compact = false }) {
  const normalizedValue = normalizeLeadStatus(value);
  const current = STATUS_OPTIONS.find(s => s.value === normalizedValue) || STATUS_OPTIONS[0];

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger className={`${compact ? 'h-8 min-w-[40px] max-w-[48px] px-2' : 'h-9 min-w-[120px] max-w-[150px] px-3'} w-auto border text-xs font-bold gap-2 focus:ring-1 focus:ring-[#FFD700] rounded-xl shadow-sm hover:border-slate-300 transition-colors font-sans ${current.pill}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${current.color} shrink-0 ring-2 ring-white shadow`} />
          {!compact && <span className="truncate">{current.label}</span>}
        </div>
      </SelectTrigger>
      <SelectContent dir="rtl">
        {STATUS_OPTIONS.map(s => (
          <SelectItem key={s.value} value={s.value} className="font-sans">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <span className="font-bold">{s.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}