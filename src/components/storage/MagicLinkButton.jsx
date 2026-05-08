import React, { useState } from 'react';
import { Link2, Copy, Check, Send, Sparkles, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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
        <DialogContent dir="rtl" className="max-w-lg">
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
              <Button onClick={copy} size="icon" variant="outline" title="העתק קישור">
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
              <a
                href={`mailto:${project.client_email || ''}?subject=${encodeURIComponent('הגלריה שלך מוכנה ✨')}&body=${encodeURIComponent(message)}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" />
                אימייל
              </a>
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