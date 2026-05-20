import React from 'react';
import { Clock, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FollowUpHistoryFeed({ activities = [] }) {
  const followUps = activities.filter((activity) =>
    String(activity.title || '').includes('פולו') ||
    String(activity.description || '').includes('WhatsApp') ||
    activity.activity_type === 'call_made' ||
    activity.activity_type === 'email_sent'
  );

  return (
    <Card className="bg-white border-slate-200 shadow-xl shadow-slate-200/60 rounded-3xl overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          היסטוריית פולו-אפ
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 px-4 max-h-64 overflow-y-auto">
        {followUps.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">עדיין אין פולו-אפים מתועדים</div>
        ) : (
          <div className="space-y-3">
            {followUps.map((activity) => (
              <div key={activity.id} className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{activity.title}</p>
                    {activity.description && <p className="text-xs text-slate-600 mt-1">{activity.description}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(activity.created_date).toLocaleString('he-IL')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}