import React, { useState } from 'react';
import { Link2, Copy, Check, Send, Sparkles, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const CLIENT_APP_ORIGIN = 'https://klikly.base44.app';

// Share-link button for a project. Generates a public Magic Link based on
// project.client_access_token and provides quick share to WhatsApp / Email / Copy.
export default function MagicLinkButton({ project, compact = false }) {
  const getDriveFolderId = (url = '') => {
    const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    return match?.[1] || '';
  };

  const folderId = getDriveFolderId(project?.drive_folder_url);
  const isSelectionGallery = project?.workflow_type === 'selection';
  const link = isSelectionGallery
    ? `${CLIENT_APP_ORIGIN}/ClientGallery/${project.id}${project.gallery_pin ? `?pin=${project.gallery_pin}` : ''}`
    : (folderId ? `${CLIENT_APP_ORIGIN}/gallery/${folderId}` : '');
  const defaultMessage = isSelectionGallery
    ? `היי ${project?.client_name || ''} 👋\n\nלבחירת תמונות לעריכה:\n${link}\n\nסמן/י בכוכב את התמונות שאהבת ולחץ/י על שמירת בחירות.`
    : `היי ${project?.client_name || ''} 👋\n\nתיקיית הקבצים שלך מוכנה להורדה ✨\n\nאפשר להוריד את כל הקבצים ישירות מהקישור הבא:\n${link}\nאין צורך בקוד גישה או התחברות.\nתהנה/י`;

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [actionStatus, setActionStatus] = useState('');

  if (!link) {
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
    setActionStatus('הקישור הועתק');
    toast.success('ההודעה עם הקישור הועתקה');
    base44.entities.SystemLog.create({
      action: 'gallery_link_copied',
      details: `Gallery link copied for project ${project?.id || ''}: ${link}`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project?.id || '',
    }).catch(() => {});
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
          {compact ? (isSelectionGallery ? 'שלח לבחירה' : 'שלח הורדה') : (isSelectionGallery ? 'שלח בחירת תמונות ללקוח' : 'שלח הורדת תיקייה ללקוח')}
        </span>
        {!compact && <Send className="w-5 h-5 text-black group-hover:translate-x-[-4px] transition-transform" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {isSelectionGallery ? `שלח בחירת תמונות ל${project.client_name}` : `שלח את הגלריה ל${project.client_name}`}
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
              onClick={() => {
                setActionStatus('WhatsApp נפתח ונרשם בלוג');
                base44.entities.SystemLog.create({
                  action: 'gallery_whatsapp_opened',
                  details: `WhatsApp share opened for project ${project?.id || ''}. Phone: ${project?.client_phone || ''}. Link: ${link}`,
                  status: 'success',
                  related_entity_type: 'Project',
                  related_entity_id: project?.id || '',
                }).catch(() => {});
              }}
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
                  setActionStatus('שולח מייל...');
                  try {
                    const res = await base44.functions.invoke('notifyClientNewFiles', {
                      project_id: project.id,
                      gallery_url: link,
                      message,
                      notification_type: 'gallery_sent',
                    });
                    if (res.data?.success) {
                      const adminCopyText = res.data?.admin_copy_sent ? ' וגם אליך' : '';
                      setActionStatus(`מייל נשלח ללקוח${adminCopyText} ונרשם בלוג המערכת`);
                      toast.success(`מייל נשלח ללקוח${adminCopyText} ונרשם בלוג`);
                    } else {
                      const errorMessage = res.data?.failed?.[0]?.error || res.data?.error || 'שגיאה בשליחת המייל';
                      setActionStatus(errorMessage);
                      toast.error(errorMessage);
                    }
                  } catch (e) {
                    const errorMessage = e?.response?.data?.error || e?.message || 'שגיאה בשליחת המייל';
                    setActionStatus(errorMessage);
                    toast.error(errorMessage);
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

            {actionStatus && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                ✓ {actionStatus}
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed border-t pt-3">
              קישור ישיר לפי תיקיית Google Drive. כל פעולה נרשמת בלוג המערכת.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}