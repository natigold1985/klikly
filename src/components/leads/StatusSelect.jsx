import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'new', label: 'חדש', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'בטיפול', color: 'bg-yellow-500' },
  { value: 'follow_up', label: 'מעקב', color: 'bg-purple-500' },
  { value: 'quote_sent', label: 'הצעה נשלחה', color: 'bg-orange-500' },
  { value: 'closed_won', label: 'נסגר ✓', color: 'bg-green-500' },
  { value: 'closed_lost', label: 'לא מעוניין', color: 'bg-red-500' },
];

export default function StatusSelect({ value, onChange }) {
  const current = STATUS_OPTIONS.find(s => s.value === value) || STATUS_OPTIONS[0];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-[150px] border border-slate-200 bg-white text-sm font-bold text-slate-900 px-3 gap-2 focus:ring-1 focus:ring-[#FFD700] rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors font-sans">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${current.color} shrink-0 ring-2 ring-white shadow`} />
          <span className="truncate">{current.label}</span>
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