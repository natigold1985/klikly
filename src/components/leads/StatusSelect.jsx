import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_STYLES } from '@/utils/leadDisplay';

const STATUS_OPTIONS = [
  { value: 'new', label: STATUS_STYLES.new.label, color: STATUS_STYLES.new.dot, pill: STATUS_STYLES.new.pill },
  { value: 'in_progress', label: STATUS_STYLES.in_progress.label, color: STATUS_STYLES.in_progress.dot, pill: STATUS_STYLES.in_progress.pill },
  { value: 'follow_up', label: STATUS_STYLES.follow_up.label, color: STATUS_STYLES.follow_up.dot, pill: STATUS_STYLES.follow_up.pill },
  { value: 'quote_sent', label: STATUS_STYLES.quote_sent.label, color: STATUS_STYLES.quote_sent.dot, pill: STATUS_STYLES.quote_sent.pill },
  { value: 'closed_won', label: STATUS_STYLES.closed_won.label, color: STATUS_STYLES.closed_won.dot, pill: STATUS_STYLES.closed_won.pill },
  { value: 'closed_lost', label: STATUS_STYLES.closed_lost.label, color: STATUS_STYLES.closed_lost.dot, pill: STATUS_STYLES.closed_lost.pill },
];

export default function StatusSelect({ value, onChange, compact = false }) {
  const current = STATUS_OPTIONS.find(s => s.value === value) || STATUS_OPTIONS[0];

  return (
    <Select value={value} onValueChange={onChange}>
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