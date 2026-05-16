import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JoniExportReminderAlert() {
  const { data: reminders = [] } = useQuery({
    queryKey: ['joniExportReminders'],
    queryFn: () => base44.entities.SystemLog.filter({ action: 'joni_export_reminder' }, '-created_date', 1),
  });

  const reminder = reminders[0];
  if (!reminder) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 shadow-sm rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-amber-800">תזכורת ייצוא לידים מ-JONI</h3>
          <p className="text-sm text-amber-700">Reminder: It's time to export your WhatsApp leads from JONI. Click here to import them.</p>
        </div>
      </div>
      <Link to={createPageUrl('LeadImport')}>
        <Button size="sm" className="gap-2 whitespace-nowrap">
          <Upload className="w-4 h-4" />
          לפתיחת Import Hub
        </Button>
      </Link>
    </div>
  );
}