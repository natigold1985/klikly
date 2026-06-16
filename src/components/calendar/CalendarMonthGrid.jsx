import React from 'react';
import CalendarDayCell from './CalendarDayCell';

const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function sameDay(a, b) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function buildMonthDays(currentDate) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function CalendarMonthGrid({ currentDate, eventsByDate }) {
  const today = new Date();
  const days = buildMonthDays(currentDate);
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[760px]" dir="rtl">
        {dayNames.map((day) => <div key={day} className="text-center text-sm font-black text-slate-500 py-2">{day}</div>)}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          return (
            <CalendarDayCell
              key={key}
              day={day}
              isCurrentMonth={day.getMonth() === currentDate.getMonth()}
              isToday={sameDay(day, today)}
              events={eventsByDate[key] || []}
            />
          );
        })}
      </div>
    </div>
  );
}