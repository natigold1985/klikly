import React from 'react';
import CalendarEventChip from './CalendarEventChip';

export default function CalendarDayCell({ day, isCurrentMonth, isToday, events }) {
  return (
    <div className={`min-h-[116px] rounded-2xl border p-2 ${isCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 text-slate-300'} ${isToday ? 'ring-2 ring-[#FFD700]' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isToday ? 'bg-[#FFD700] text-black' : 'text-slate-700'}`}>
          {day.getDate()}
        </span>
        {events.length > 0 && <span className="text-[10px] font-bold text-blue-600">{events.length}</span>}
      </div>
      <div className="space-y-1">
        {events.slice(0, 3).map((event) => <CalendarEventChip key={event.id} event={event} />)}
        {events.length > 3 && <div className="text-[11px] text-slate-500 font-bold px-1">+{events.length - 3} נוספים</div>}
      </div>
    </div>
  );
}