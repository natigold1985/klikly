import React, { useState } from 'react';
import { Link2, Copy, Check, Send, Sparkles, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Share-link button for a project. Generates a public Magic Link based on
// project.client_access_token and provides quick share to WhatsApp / Email / Copy.
export default function MagicLinkButton({ project, compact = false }) {
  const getDriveFolderId = (url = '') => {
    const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    return match?.[1] || '';
  };

  const folderId = getDriveFolderId(project?.drive_folder_url);
  const link = folderId ? `${window.location.origin}/gallery/${folderId}` : '';
  const defaultMessage = `היי ${project?.client_name || ''} 👋\n\nהגלריה שלך מוכנה! ✨\n\nאפשר לצפות בכל התמונות ולהוריד אותן ישירות מהקישור הבא:\n${link}\nאין צורך בקוד גישה או התחברות.\nתהנה/י`;

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [sendingEmail, setSendingEmail] = useState(false);

  if (!folderId) {
    return (
      <Button variant="outline" disabled className={compact ? 'w-full h-10 gap-1 text-xs px-2' : 'gap-2'}>
        <Link2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {compact ? 'אין קישור' : 'אין קישור (חסרה תיקיית Drive)'}
      </Button>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('ההודעה עם הקישור הועתקה');
    setTimeout(() => setCopied(false), 2000);
  };

  // Build WhatsApp link — use client phone if available for direct chat
  const phoneClean = (project.client_phone || '').replace(/[^0-9]/g, '');
  const phoneIntl = phoneClean.startsWith('0') ? '972' + phoneClean.slice(1) : phoneClean;
  const whatsappUrl = phoneIntl
    ? `https://wa.me/${phoneIntl}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <>
      <button
        onClick={() => {
          setMessage(defaultMessage);
          setOpen(true);
        }}
        className={compact
          ? 'w-full h-10 rounded-xl border border-[#E0B82A] bg-[#FFD700] text-black hover:bg-[#E5B800] transition-colors px-3 flex items-center justify-center gap-1.5 text-xs font-bold'
          : 'group relative w-full md:w-auto overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFD700] via-[#FFC700] to-[#D4AF37] hover:shadow-[0_8px_30px_rgba(255,215,0,0.5)] active:scale-[0.98] transition-all duration-300 px-6 md:px-10 py-4 md:py-5 flex items-center justify-center gap-3'
        }
      >
        <Sparkles className={compact ? 'w-3.5 h-3.5 text-black shrink-0' : 'w-6 h-6 text-black'} />
        <span className={compact ? 'text-xs font-bold text-black truncate' : 'text-lg md:text-xl font-bold text-black tracking-wide'}>
          {compact ? 'שלח גלריה' : 'שלח גלריה ללקוח'}
        </span>
        {!compact && <Send className="w-5 h-5 text-black group-hover:translate-x-[-4px] transition-transform" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-amber-500" />
              שלח את הגלריה ל{project.client_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Editable message */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                ההודעה שתישלח (ניתן לערוך):
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="text-sm resize-none"
              />
            </div>

            {/* Preview link */}
            <div className="flex gap-2">
              <Input value={link} readOnly className="text-xs font-mono" dir="ltr" onClick={(e) => e.target.select()} />
              <Button onClick={copy} size="icon" variant="outline" title="העתק קישור" className="text-slate-900 border-slate-300 bg-white hover:bg-slate-50">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            {/* PRIMARY action: WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-500/40 active:scale-[0.98] transition-all text-base font-bold"
            >
              <Send className="w-5 h-5" />
              {phoneIntl ? `שלח ב-WhatsApp ל-${project.client_phone}` : 'פתח WhatsApp'}
            </a>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={sendingEmail}
                onClick={async () => {
                  const email = project.client_email;
                  if (!email) { toast.error('לא הוגדר מייל ללקוח'); return; }
                  setSendingEmail(true);
                  try {
                    const galleryEmailHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);padding:32px 40px;text-align:center;border-bottom:2px solid #FFD700;">
          <div style="color:#FFD700;font-size:32px;font-weight:900;letter-spacing:4px;text-shadow:0 0 20px rgba(255,215,0,0.3);">KLIKLY</div>
          <div style="color:#888;font-size:12px;letter-spacing:2px;margin-top:4px;text-transform:uppercase;">מערכת ניהול גלריות מקצועית</div>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#FFD700 0%,#D4AF37 100%);padding:28px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🎉</div>
          <h1 style="color:#000;font-size:24px;font-weight:900;margin:0;letter-spacing:1px;">הגלריה שלך מוכנה!</h1>
          <p style="color:#1a1a1a;font-size:14px;margin:8px 0 0;font-weight:600;">הצילומים שלך מחכים לך</p>
        </td></tr>
        <tr><td style="padding:36px 40px 28px;">
          <p style="color:#cccccc;font-size:18px;line-height:1.7;margin:0 0 12px;">היי ${project.client_name || ''} 👋</p>
          <p style="color:#aaaaaa;font-size:16px;line-height:1.7;margin:0 0 28px;">
            הגלריה שלך מוכנה לצפייה ולהורדה! לחץ על הכפתור למטה כדי לצפות בכל התמונות ולהוריד אותן.
          </p>
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#D4AF37);color:#000;font-size:17px;font-weight:900;padding:18px 52px;border-radius:14px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,215,0,0.3);">
              📸 לצפייה בגלריה שלי
            </a>
          </div>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <p style="color:#FFD700;font-size:14px;font-weight:700;margin:0 0 10px;">🔗 קישור ישיר לגלריה:</p>
            <p style="color:#888;font-size:12px;word-break:break-all;margin:0;direction:ltr;text-align:left;">${link}</p>
          </div>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0 20px;">
          <p style="color:#555;font-size:11px;margin:0;text-align:center;line-height:1.8;">
            הודעה אוטומטית מ-KLIKLY · לא להשיב למייל זה<br>
            קיבלת מייל זה מכיוון שהצלם שלך שיתף איתך גלריה. לביטול קבלת הודעות עתידיות,
            <a href="https://app.klikly.com/unsubscribe" style="color:#888;text-decoration:underline;">לחץ כאן להסרה מרשימת התפוצה</a>.
          </p>
        </td></tr>
        <tr><td style="background:#0a0a0a;padding:20px 40px;text-align:center;border-top:1px solid #2a2a2a;">
          <div style="color:#FFD700;font-size:16px;font-weight:900;letter-spacing:3px;">KLIKLY</div>
          <div style="color:#444;font-size:11px;margin-top:4px;">© 2024 Klikly. כל הזכויות שמורות.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
                    await base44.integrations.Core.SendEmail({
                      to: email,
                      from_name: 'KLIKLY',
                      subject: `📸 הגלריה שלך מוכנה - ${project.client_name || ''}`,
                      body: galleryEmailHtml,
                    });
                    toast.success(`מייל נשלח ל-${email}`);
                  } catch (e) {
                    toast.error('שגיאה בשליחת המייל');
                  } finally {
                    setSendingEmail(false);
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors text-sm font-medium disabled:opacity-60"
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                אימייל
              </button>
              <button
                onClick={copy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                העתק קישור
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed border-t pt-3">
              קישור ישיר לפי תיקיית Google Drive. הלקוח יוכל לצפות ולהוריד בלי התחברות ובלי בקשות הרשאה.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}