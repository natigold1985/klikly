import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Mail, MessageCircle, Clock, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const DEFAULT_MSG = (name) =>
  `היי, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לדעת אם יש עוד שאלות ונוכל להתקדם, מחכה לשמוע ממך! 📸`;

export default function AutoFollowUpDialog({ open, onOpenChange, lead, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState('whatsapp');
  const [intervalDays, setIntervalDays] = useState(3);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [message, setMessage] = useState('');
  const [sendTime, setSendTime] = useState('10:00');
  const [sendDay, setSendDay] = useState('any');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setEnabled(!!lead.auto_followup_enabled);
    setChannel(lead.auto_followup_channel || 'whatsapp');
    setIntervalDays(lead.auto_followup_interval_days || 3);
    setMaxAttempts(lead.auto_followup_max_attempts || 3);
    setMessage(lead.auto_followup_message || DEFAULT_MSG(lead.name));
    setSendTime(lead.auto_followup_send_time || '10:00');
    setSendDay(lead.auto_followup_send_day || 'any');
    setPushEnabled(lead.auto_followup_push_enabled !== false);
  }, [lead]);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const buildNextSend = () => {
        const [hours, minutes] = sendTime.split(':').map(Number);
        const now = new Date();
        const next = new Date();
        next.setHours(hours || 10, minutes || 0, 0, 0);

        if (sendDay !== 'any') {
          const targetDay = Number(sendDay);
          while (next.getDay() !== targetDay || next <= now) {
            next.setDate(next.getDate() + 1);
          }
        } else if (next <= now) {
          next.setDate(next.getDate() + Number(intervalDays));
        }

        return next;
      };
      const nextSend = buildNextSend();

      await base44.entities.Lead.update(lead.id, {
        auto_followup_enabled: enabled,
        auto_followup_channel: channel,
        auto_followup_interval_days: Number(intervalDays),
        auto_followup_max_attempts: Number(maxAttempts),
        auto_followup_message: message,
        auto_followup_send_time: sendTime,
        auto_followup_send_day: sendDay,
        auto_followup_push_enabled: pushEnabled,
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
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-3xl px-4 sm:px-6 fixed bottom-0 sm:bottom-auto" dir="rtl">
        <DialogHeader className="text-right border-b border-slate-100 pb-4">
          <DialogTitle className="flex items-center justify-between gap-3 text-slate-950">
            <span className="flex items-center gap-3 text-xl font-black">
              <span className="w-11 h-11 rounded-2xl bg-[#FFD700] flex items-center justify-center shadow-lg shadow-yellow-200">
                <Zap className="w-5 h-5 text-black" />
              </span>
              פולו־אפ אוטומטי{lead?.name ? ` · ${lead.name}` : ''}
            </span>
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm pt-2 leading-relaxed">
            בחר ערוץ, תדירות, יום ושעה לשליחה. אם השעה שבחרת עוד לא עברה היום — הפולו־אפ יישלח היום.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner">
            <div>
              <p className="font-black text-slate-900 text-sm">הפעל פולו־אפ אוטומטי</p>
              <p className="text-xs text-slate-500 mt-1">המערכת תשלח/תכין הודעות מעקב בזמן שבחרת</p>
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

          {/* Timing + max attempts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><Clock className="w-4 h-4" /> כל כמה ימים</label>
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
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">מספר ניסיונות</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">שעת שליחה</label>
              <Input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">יום שליחה</label>
              <Select value={sendDay} onValueChange={setSendDay} disabled={!enabled}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="any">כל יום מתאים</SelectItem>
                  <SelectItem value="0">ראשון</SelectItem>
                  <SelectItem value="1">שני</SelectItem>
                  <SelectItem value="2">שלישי</SelectItem>
                  <SelectItem value="3">רביעי</SelectItem>
                  <SelectItem value="4">חמישי</SelectItem>
                  <SelectItem value="5">שישי</SelectItem>
                  <SelectItem value="6">שבת</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50 border border-blue-100">
            <div>
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5"><Bell className="w-4 h-4 text-blue-600" /> התראת פוש אחרי שליחה</p>
              <p className="text-xs text-slate-500 mt-0.5">תקבל התראה כשהמערכת שולחת או מכינה פולו־אפ</p>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} disabled={!enabled} />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">תוכן ההודעה</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!enabled}
              rows="4"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] disabled:bg-slate-50 disabled:text-slate-400 text-sm resize-none"
            />
          </div>

          {lead?.auto_followup_attempts_sent > 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
              נשלחו עד כה: <strong>{lead.auto_followup_attempts_sent}</strong> הודעות.
              {lead.auto_followup_last_sent && ` אחרונה: ${new Date(lead.auto_followup_last_sent).toLocaleString('he-IL')}`}
            </div>
          )}

          <div className="space-y-2 pt-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#FFD700] hover:bg-[#E5B800] text-black font-bold py-2.5"
            >
              {saving ? 'שומר...' : 'שמור הגדרות'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full border-slate-300 py-2.5"
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}