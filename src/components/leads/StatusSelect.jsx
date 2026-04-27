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
      <SelectTrigger className="h-8 w-[130px] border-none bg-transparent text-xs font-bold px-2 gap-1 focus:ring-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${current.color} shrink-0`} />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent dir="rtl">
        {STATUS_OPTIONS.map(s => (
          <SelectItem key={s.value} value={s.value}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              {s.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}