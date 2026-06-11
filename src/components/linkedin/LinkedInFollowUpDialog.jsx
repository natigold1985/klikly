import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  'היי, שלחתי לך בקשת חברות — אשמח להתחבר!',
  'שלום, ראיתי את הפרופיל שלך ואשמח לשוחח על שיתוף פעולה',
  'היי, מחובר עכשיו! אשמח לספר בקצרה מה אנחנו עושים',
  'פולו-אפ — עדיין לא ענית, האם הבקשה שלחתי הגיעה?',
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'ליד חדש' },
  { value: 'contacted', label: 'נשלחה בקשת חברות' },
  { value: 'connected', label: 'מחובר' },
  { value: 'messaged', label: 'נשלחה הודעה' },
  { value: 'reviewed', label: 'נענה' },
  { value: 'dismissed', label: 'לא רלוונטי' },
];

export default function LinkedInFollowUpDialog({ lead, open, onOpenChange, onSaved }) {
  const name = (lead?.title || '').split(' - ')[0] || lead?.title || '';
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(lead?.status || 'messaged');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toLocaleDateString('he-IL');
      const newNotes = lead.notes
        ? `${lead.notes}\n[${today}] ${message}`
        : `[${today}] ${message}`;

      await base44.entities.PotentialLead.update(lead.id, {
        status,
        notes: newNotes,
        contact_date: new Date().toISOString().split('T')[0],
      });

      try {
        await base44.functions.invoke('syncLinkedInOutreachToSheet', { syncAll: true });
      } catch (e) { /* non-fatal */ }

      toast.success('פולו-אפ נשמר ✓');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            פולו-אפ עם {name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-2">תבניות מהירות</label>
            <div className="space-y-1.5">
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(t)}
                  className={`w-full text-right text-xs px-3 py-2 rounded-lg border transition-all ${
                    message === t
                      ? 'border-purple-400 bg-purple-50 text-purple-800'
                      : 'border-slate-200 hover:border-purple-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">הערה</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              placeholder="כתוב הערה על הפולו-אפ..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">עדכן סטטוס</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {lead?.source_url && (
            <a
              href={lead.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Send className="w-4 h-4" />
              פתח פרופיל LinkedIn לשליחת הודעה
            </a>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving || !message} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
            {saving ? 'שומר...' : 'שמור פולו-אפ'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 text-slate-700">
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}