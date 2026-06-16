import React from 'react';
import { Link } from 'react-router-dom';

export default function CalendarEventChip({ event }) {
  return (
    <Link
      to={`/LeadDetails?id=${event.id}`}
      className="block rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2 py-1 text-[11px] leading-tight text-blue-900 transition-colors truncate"
      title={event.name}
    >
      {event.name || 'לקוח'}
    </Link>
  );
}