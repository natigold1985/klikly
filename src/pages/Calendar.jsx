import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import CalendarStats from '@/components/calendar/CalendarStats';
import CalendarMonthGrid from '@/components/calendar/CalendarMonthGrid';
import CalendarEventList from '@/components/calendar/CalendarEventList';

function formatMonth(date) {
  return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeEvent(lead) {
  const date = String(lead.event_date || '').slice(0, 10);
  return {
    ...lead,
    date,
    dateLabel: date ? new Date(`${date}T12:00:00`).toLocaleDateString('he-IL') : 'ללא תאריך',
  };
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['closedLeadCalendarEvents'],
    queryFn: () => base44.entities.Lead.filter({ status: 'נסגר בהצלחה' }, '-event_date', 500),
  });

  const events = useMemo(() => leads
    .filter((lead) => lead.google_calendar_event_id && lead.event_date)
    .map(normalizeEvent)
    .sort((a, b) => new Date(a.date) - new Date(b.date)), [leads]);

  const visibleEvents = useMemo(() => events.filter((event) => monthKey(new Date(`${event.date}T12:00:00`)) === monthKey(currentDate)), [events, currentDate]);
  const eventsByDate = useMemo(() => visibleEvents.reduce((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event];
    return acc;
  }, {}), [visibleEvents]);

  const moveMonth = (amount) => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() + amount, 1));

  if (isLoading) return <div className="p-8 text-center text-slate-500">טוען לוח שנה...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20" dir="rtl">
      <CalendarHeader
        monthLabel={formatMonth(currentDate)}
        onPrev={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
        onToday={() => setCurrentDate(new Date())}
      />
      <CalendarStats events={events} />
      <CalendarMonthGrid currentDate={currentDate} eventsByDate={eventsByDate} />
      <CalendarEventList events={visibleEvents} />
    </div>
  );
}