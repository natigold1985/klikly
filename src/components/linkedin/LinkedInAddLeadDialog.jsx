import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Linkedin } from 'lucide-react';

const DEFAULT_FORM = {
  name: '',
  jobTitle: '',
  company: '',
  email: '',
  profileUrl: '',
  outreachUrl: '',
  notes: '',
  status: 'new',
  contactDate: new Date().toISOString().split('T')[0],
  requestSentDate: '',
};

export default function LinkedInAddLeadDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await base44.entities.PotentialLead.create({
        title: form.jobTitle ? `${form.name} - ${form.jobTitle}` : form.name,
        source_url: form.profileUrl || form.outreachUrl,
        platform: 'linkedin',
        snippet: form.company ? `${form.company} - ${form.jobTitle || ''}` : '',
        keywords_matched: 'שיווק, HR, משקיות, חינוך, חוויה',
        relevance_score: 7,
        contact_info: form.email || '',
        status: form.status,
        notes: [
          form.notes,
          form.outreachUrl ? `🔗 קישור לשליחה: ${form.outreachUrl}` : '',
        ].filter(Boolean).join('\n'),
        contact_date: form.contactDate || new Date().toISOString().split('T')[0],
        request_sent_date: form.requestSentDate || null,
      });
      try {
        await base44.functions.invoke('syncLinkedInOutreachToSheet', { syncAll: true });
      } catch (e) { /* non-fatal */ }
      onSaved();
      onOpenChange(false);
      setForm(DEFAULT_FORM);
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-600" />
            הוסף איש קשר LinkedIn
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">שם מלא *</label>
            <Input value={form.name} onChange={set('name')} placeholder="ישראל ישראלי" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">תפקיד</label>
              <Input value={form.jobTitle} onChange={set('jobTitle')} placeholder="מנהל שיווק" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">חברה</label>
              <Input value={form.company} onChange={set('company')} placeholder="אלביט מערכות" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">מייל</label>
            <Input value={form.email} onChange={set('email')} placeholder="name@co.il" type="email" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">קישור פרופיל LinkedIn</label>
            <Input value={form.profileUrl} onChange={set('profileUrl')} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">🔗 URL לשליחת בקשת חברות</label>
            <Input value={form.outreachUrl} onChange={set('outreachUrl')} placeholder="https://linkedin.com/in/.../connect" />
            <p className="text-xs text-slate-400 mt-0.5">הקישור הישיר לשליחת הבקשה</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">סטטוס</label>
            <select
              value={form.status}
              onChange={set('status')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="new">טרם פנייה</option>
              <option value="request_sent">נשלחה בקשת חברות</option>
              <option value="contacted">נשלחה פנייה</option>
              <option value="follow_up">מעקב</option>
              <option value="messaged">נשלחה הודעה ראשונה</option>
              <option value="dismissed">לא רלוונטי</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">תאריך הוספה</label>
              <Input type="date" value={form.contactDate} onChange={set('contactDate')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">תאריך בקשת חברות</label>
              <Input type="date" value={form.requestSentDate} onChange={set('requestSentDate')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">הערות</label>
            <Input value={form.notes} onChange={set('notes')} placeholder="הערה חופשית..." />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving || !form.name} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'שומר...' : 'הוסף איש קשר'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 text-slate-700">
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}