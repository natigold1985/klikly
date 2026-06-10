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
export default function MagicLinkButton({ project }) {
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
      <Button variant="outline" disabled className="gap-2">
        <Link2 className="w-4 h-4" />
        אין קישור (חסרה תיקיית Drive)
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
      {/* MASSIVE prominent "Send Gallery" button */}
      <button
        onClick={() => {
          setMessage(defaultMessage);
          setOpen(true);
        }}
        className="group relative w-full md:w-auto overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFD700] via-[#FFC700] to-[#D4AF37] hover:shadow-[0_8px_30px_rgba(255,215,0,0.5)] active:scale-[0.98] transition-all duration-300 px-6 md:px-10 py-4 md:py-5 flex items-center justify-center gap-3"
      >
        <Sparkles className="w-6 h-6 text-black" />
        <span className="text-lg md:text-xl font-bold text-black tracking-wide">
          שלח גלריה ללקוח
        </span>
        <Send className="w-5 h-5 text-black group-hover:translate-x-[-4px] transition-transform" />
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
                    await base44.integrations.Core.SendEmail({
                      to: email,
                      from_name: 'KLIKLY',
                      subject: `📸 הגלריה שלך מוכנה - ${project.client_name || ''}`,
                      body: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;direction:rtl;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;"><tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><tr><td style="background:#0a0a0a;padding:24px 40px;text-align:center;"><span style="color:#FFD700;font-size:26px;font-weight:900;letter-spacing:3px;">KLIKLY</span></td></tr><tr><td style="padding:36px 40px 28px;"><h2 style="color:#0a0a0a;font-size:22px;margin:0 0 12px;">היי ${project.client_name || ''} 🎉</h2><p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 24px;">הגלריה שלך מוכנה לצפייה והורדה!</p><div style="text-align:center;margin:24px 0;"><a href="${link}" style="display:inline-block;background:#FFD700;color:#000;font-size:16px;font-weight:700;padding:16px 48px;border-radius:12px;text-decoration:none;">📁 לצפייה בגלריה</a></div><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;"><p style="color:#999;font-size:12px;margin:0;text-align:center;">KLIKLY · מערכת ניהול גלריות מקצועית</p></td></tr></table></td></tr></table></body></html>`,
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