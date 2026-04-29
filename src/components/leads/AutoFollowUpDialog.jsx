import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Mail, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const DEFAULT_MSG = (name) =>
  `היי ${name || ''}, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לענות על כל שאלה ולתאם איתך את הצילום. מחכה לשמוע ממך! 📸`;

export default function AutoFollowUpDialog({ open, onOpenChange, lead, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState('whatsapp');
  const [intervalDays, setIntervalDays] = useState(3);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setEnabled(!!lead.auto_followup_enabled);
    setChannel(lead.auto_followup_channel || 'whatsapp');
    setIntervalDays(lead.auto_followup_interval_days || 3);
    setMaxAttempts(lead.auto_followup_max_attempts || 3);
    setMessage(lead.auto_followup_message || DEFAULT_MSG(lead.name));
  }, [lead]);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const now = new Date();
      const nextSend = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

      await base44.entities.Lead.update(lead.id, {
        auto_followup_enabled: enabled,
        auto_followup_channel: channel,
        auto_followup_interval_days: Number(intervalDays),
        auto_followup_max_attempts: Number(maxAttempts),
        auto_followup_message: message,
        auto_followup_next_send: enabled ? nextSend.toISOString() : null,
        auto_followup_attempts_sent: enabled ? (lead.auto_followup_attempts_sent || 0) : 0,
      });

      toast.success(enabled ? 'פולו-אפ אוטומטי הופעל' : 'פולו-אפ אוטומטי הופסק');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error('שגיאה בשמירה: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700] flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            פולו-אפ אוטומטי {lead?.name && `– ${lead.name}`}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm pt-1">
            המערכת תשלח הודעות מעקב אוטומטיות לפי הזמנים שתגדיר.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="font-bold text-slate-900 text-sm">הפעל פולו-אפ אוטומטי</p>
              <p className="text-xs text-slate-500 mt-0.5">המערכת תשלח הודעות מעקב באופן עצמאי</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Channel */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">ערוץ שליחה</label>
            <Select value={channel} onValueChange={setChannel} disabled={!enabled}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="whatsapp">
                  <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-600" /> וואטסאפ</span>
                </SelectItem>
                <SelectItem value="email">
                  <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> מייל</span>
                </SelectItem>
                <SelectItem value="both">
                  <span className="flex items-center gap-2">וואטסאפ + מייל</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {(channel === 'email' || channel === 'both') && !lead?.email && (
              <p className="text-xs text-amber-600 mt-1">⚠ ללא כתובת מייל לא תישלח הודעת מייל</p>
            )}
          </div>

          {/* Frequency + max attempts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">כל כמה ימים</label>
              <Input
                type="number"
                min="1"
                max="30"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">מספר ניסיונות</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                disabled={!enabled}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">תוכן ההודעה</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!enabled}
              rows="4"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] disabled:bg-slate-50 disabled:text-slate-400 text-sm"
            />
          </div>

          {lead?.auto_followup_attempts_sent > 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
              נשלחו עד כה: <strong>{lead.auto_followup_attempts_sent}</strong> הודעות.
              {lead.auto_followup_last_sent && ` אחרונה: ${new Date(lead.auto_followup_last_sent).toLocaleString('he-IL')}`}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#FFD700] hover:bg-[#E5B800] text-black font-bold"
          >
            {saving ? 'שומר...' : 'שמור הגדרות'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}