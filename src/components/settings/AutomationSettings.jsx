import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BellRing } from 'lucide-react';

export default function AutomationSettings({ formData, setFormData }) {
  return (
    <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <BellRing className="w-5 h-5 text-[#FFD700]" />
          תזכורות ופולואפים אוטומטיים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Lead reminder */}
        <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">תזכורת לידים פתוחים</p>
            <p className="text-xs text-slate-500 mt-1">קבל מייל יומי עם רשימת לידים שלא נסגרו</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-600">אחרי</span>
              <Input
                type="number"
                min="1"
                max="30"
                value={formData.lead_followup_days ?? 3}
                onChange={(e) => setFormData({ ...formData, lead_followup_days: parseInt(e.target.value) || 3 })}
                className="w-16 h-8 text-center"
              />
              <span className="text-xs text-slate-600">ימים</span>
            </div>
          </div>
          <Switch
            checked={formData.lead_followup_enabled !== false}
            onCheckedChange={(v) => setFormData({ ...formData, lead_followup_enabled: v })}
          />
        </div>

        {/* Quote follow-up */}
        <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">פולואפ אוטומטי על הצעות מחיר</p>
            <p className="text-xs text-slate-500 mt-1">שלח מייל ללקוח שלא ענה להצעת מחיר</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-600">אחרי</span>
              <Input
                type="number"
                min="1"
                max="30"
                value={formData.quote_followup_days ?? 2}
                onChange={(e) => setFormData({ ...formData, quote_followup_days: parseInt(e.target.value) || 2 })}
                className="w-16 h-8 text-center"
              />
              <span className="text-xs text-slate-600">ימים</span>
            </div>
          </div>
          <Switch
            checked={formData.quote_followup_enabled !== false}
            onCheckedChange={(v) => setFormData({ ...formData, quote_followup_enabled: v })}
          />
        </div>

        {/* Urgent task push */}
        <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">פוש למשימות דחופות</p>
            <p className="text-xs text-slate-500 mt-1">קבל פוש בבוקר על משימות דחופות / באיחור</p>
          </div>
          <Switch
            checked={formData.urgent_task_push_enabled !== false}
            onCheckedChange={(v) => setFormData({ ...formData, urgent_task_push_enabled: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}