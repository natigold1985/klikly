import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle, Copy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function cleanPhone(phone = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');

  if (/^05\d{8}$/.test(digits)) return `972${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `972${digits}`;
  if (/^9725\d{8}$/.test(digits)) return digits;

  return '';
}

function firstName(name = '') {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function personalize(text, subscriber) {
  return String(text || '')
    .replaceAll('{{שם}}', firstName(subscriber.full_name))
    .replaceAll('{{שם מלא}}', subscriber.full_name || '')
    .replaceAll('{{אימייל}}', subscriber.email || '');
}

export default function BroadcastActions() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('היי {{שם}}, רציתי לשתף אותך במשהו חדש');
  const [message, setMessage] = useState('היי {{שם}}, כאן נתי גולד. רציתי לעדכן אותך במשהו שיכול לעזור לעסק שלך עם צילום/וידאו מקצועי.');
  const [sending, setSending] = useState(false);
  const [whatsappIndex, setWhatsappIndex] = useState(0);
  const [emailIndex, setEmailIndex] = useState(0);

  const { data: subscribers = [] } = useQuery({
    queryKey: ['broadcastSubscribers'],
    queryFn: () => base44.entities.NewsletterSubscriber.list('-created_date', 1000),
  });

  const activeSubscribers = useMemo(() => {
    return subscribers.filter((subscriber) => (
      subscriber.status === 'active' &&
      subscriber.consent_given === true &&
      !!subscriber.consent_timestamp &&
      !!subscriber.consent_text
    ));
  }, [subscribers]);

  const emailRecipients = activeSubscribers.filter((subscriber) => subscriber.email);
  const whatsappRecipients = activeSubscribers.filter((subscriber) => cleanPhone(subscriber.phone));

  const currentWhatsappRecipient = whatsappRecipients[whatsappIndex] || null;
  const currentWhatsappPhone = currentWhatsappRecipient ? cleanPhone(currentWhatsappRecipient.phone) : '';
  const currentEmailRecipient = emailRecipients[emailIndex] || null;

  const buildWhatsappLink = (subscriber) => {
    const phone = cleanPhone(subscriber.phone);
    return `https://wa.me/${phone}?text=${encodeURIComponent(personalize(message, subscriber))}`;
  };

  const buildMailtoLink = (subscriber) => {
    return `mailto:${subscriber.email}?subject=${encodeURIComponent(personalize(subject, subscriber))}&body=${encodeURIComponent(personalize(message, subscriber))}`;
  };

  const sendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('צריך למלא נושא והודעה');
      return;
    }

    navigator.clipboard.writeText(emailRecipients.map((subscriber) => subscriber.email).join(', '));
    toast.error('שליחה אוטומטית למיילים חיצוניים דורשת חיבור ספק מייל ייעודי. בינתיים רשימת המיילים הועתקה ואפשר לשלוח אחד־אחד.', { duration: 7000 });
  };

  const openWhatsAppRecipient = (index) => {
    const subscriber = whatsappRecipients[index];
    if (!subscriber) {
      toast.error('אין נמען וואטסאפ לפתיחה');
      return;
    }

    setWhatsappIndex(index);
    navigator.clipboard.writeText(personalize(message, subscriber));
    window.open(buildWhatsappLink(subscriber), '_blank');
    toast.success(`נפתח וואטסאפ לנמען ${index + 1} מתוך ${whatsappRecipients.length}`);
  };

  const openWhatsApp = () => {
    if (!whatsappRecipients.length) {
      toast.error('אין נמענים עם מספר טלפון ישראלי תקין');
      return;
    }

    openWhatsAppRecipient(whatsappIndex);
  };

  const openNextWhatsApp = () => {
    const nextIndex = Math.min(whatsappIndex + 1, whatsappRecipients.length - 1);
    if (nextIndex === whatsappIndex) {
      toast.success('הגעת לסוף רשימת הוואטסאפ');
      return;
    }
    openWhatsAppRecipient(nextIndex);
  };

  const openEmailRecipient = (index) => {
    const subscriber = emailRecipients[index];
    if (!subscriber) {
      toast.error('אין נמען מייל לפתיחה');
      return;
    }

    setEmailIndex(index);
    window.location.href = buildMailtoLink(subscriber);
    toast.success(`נפתח מייל לנמען ${index + 1} מתוך ${emailRecipients.length}`);
  };

  const openNextEmail = () => {
    const nextIndex = Math.min(emailIndex + 1, emailRecipients.length - 1);
    if (nextIndex === emailIndex) {
      toast.success('הגעת לסוף רשימת המיילים');
      return;
    }
    openEmailRecipient(nextIndex);
  };

  const copyEmailList = () => {
    navigator.clipboard.writeText(emailRecipients.map((subscriber) => subscriber.email).join(', '));
    toast.success('רשימת המיילים הועתקה');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
          <Users className="w-4 h-4" />
          תפוצה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>שליחת תפוצה למאשרי דיוור</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">נמעני מייל</div>
              <div className="text-2xl font-bold text-slate-900">{emailRecipients.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">נמעני וואטסאפ</div>
              <div className="text-2xl font-bold text-slate-900">{whatsappRecipients.length}</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">נושא המייל</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">הודעה</label>
            <Textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">אפשר להשתמש ב־{'{{שם}}'} לשם פרטי.</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-bold text-emerald-900">שליחת וואטסאפ אחד־אחד</div>
                <div className="text-emerald-700">
                  {currentWhatsappRecipient
                    ? `${whatsappIndex + 1}/${whatsappRecipients.length} · ${currentWhatsappRecipient.full_name || currentWhatsappRecipient.email || 'ללא שם'} · ${currentWhatsappPhone}`
                    : 'אין נמענים עם מספר ישראלי תקין'}
                </div>
              </div>
              <MessageCircle className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={openWhatsApp} variant="outline" disabled={whatsappRecipients.length === 0} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                פתח נמען נוכחי
              </Button>
              <Button onClick={openNextWhatsApp} variant="outline" disabled={whatsappRecipients.length === 0 || whatsappIndex >= whatsappRecipients.length - 1} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                פתח הבא
              </Button>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              אם וואטסאפ מציג שהמספר לא קיים — זה אומר שהמספר עצמו לא מחובר ל-WhatsApp או הוזן לא נכון, ואז פשוט עוברים לנמען הבא.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-bold text-amber-900">שליחת מייל אחד־אחד</div>
                <div className="text-amber-700">
                  {currentEmailRecipient
                    ? `${emailIndex + 1}/${emailRecipients.length} · ${currentEmailRecipient.full_name || currentEmailRecipient.email} · ${currentEmailRecipient.email}`
                    : 'אין נמענים עם מייל תקין'}
                </div>
              </div>
              <Mail className="w-5 h-5 text-amber-700" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => openEmailRecipient(emailIndex)} variant="outline" disabled={emailRecipients.length === 0} className="border-amber-300 text-amber-800 hover:bg-amber-100">
                פתח מייל נוכחי
              </Button>
              <Button onClick={openNextEmail} variant="outline" disabled={emailRecipients.length === 0 || emailIndex >= emailRecipients.length - 1} className="border-amber-300 text-amber-800 hover:bg-amber-100">
                פתח הבא
              </Button>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              זה פותח את תוכנת המייל שלך עם נמען, נושא והודעה מוכנים — בלי מגבלת Base44 לנמענים חיצוניים.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={sendEmail} disabled={sending || emailRecipients.length === 0} className="bg-[#D4AF37] hover:bg-[#C5A028] text-black font-bold">
              <Mail className="w-4 h-4 ml-2" />
              נסה אוטומציה
            </Button>
            <Button onClick={copyEmailList} variant="outline" disabled={emailRecipients.length === 0}>
              <Copy className="w-4 h-4 ml-2" />
              העתק מיילים
            </Button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            מייל ו-WhatsApp נפתחים אחד־אחד עם הודעה מוכנה למי שאישר דיוור. אוטומציה מלאה למיילים חיצוניים דורשת חיבור ספק מייל ייעודי כמו Resend/Mailchimp.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}