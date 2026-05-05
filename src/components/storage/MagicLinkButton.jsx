import React, { useState } from 'react';
import { Link2, Copy, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Share-link button for a project. Generates a public Magic Link based on
// project.client_access_token and provides quick share to WhatsApp / Email / Copy.
export default function MagicLinkButton({ project }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!project?.client_access_token) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Link2 className="w-4 h-4" />
        אין קישור (חסר token)
      </Button>
    );
  }

  const link = `${window.location.origin}/g/${project.client_access_token}`;
  const shareText = `שלום ${project.client_name}, הגלריה שלך מוכנה לצפייה והורדה:\n${link}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('הקישור הועתק');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="gap-2">
        <Link2 className="w-4 h-4" />
        Magic Link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              קישור גלריה ללקוח
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">
              שלח את הקישור ל-<strong>{project.client_name}</strong> — הוא יוכל לצפות ולהוריד את הקבצים בלי צורך בהתחברות.
            </p>

            <div className="flex gap-2">
              <Input value={link} readOnly className="text-xs" onClick={(e) => e.target.select()} />
              <Button onClick={copy} size="icon" variant="outline">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                WhatsApp
              </a>
              <a
                href={`mailto:${project.client_email || ''}?subject=${encodeURIComponent('הגלריה שלך מוכנה')}&body=${encodeURIComponent(shareText)}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                אימייל
              </a>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed border-t pt-3">
              הקישור מציג את תיקיית "ערוכות" מתוך תיקיית הפרויקט ב-Google Drive שלך. כל הורדה של הלקוח שולחת לך התראה.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}