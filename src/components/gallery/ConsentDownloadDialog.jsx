import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const CONSENT_TEXT = 'באישור זה אני מאשר/ת שקיבלתי גישה לקבצי הפרויקט ומתחיל/ה בהורדתם למכשיר האישי שלי. ידוע לי כי STUDIO GOLD והצלם שומרים גיבוי זמני של הקבצים למשך עד 90 ימים ממועד מסירת הקישור או תחילת ההורדה, ולאחר תקופה זו לא תהיה ל-STUDIO GOLD, לצלם או למי מטעמם כל אחריות לשמירה, שחזור, אובדן או מחיקה של הקבצים. באחריותי לוודא שהקבצים ירדו ונשמרו אצלי באופן תקין.';

export default function ConsentDownloadDialog({ open, busy, progress = '', error = '', driveFolderUrl = '', onClose, onConfirm }) {
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[2rem] border border-[#FFD700]/30 bg-[#070707] text-white shadow-[0_0_80px_rgba(255,215,0,0.25)] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFD700]/15 flex items-center justify-center text-[#FFD700]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">אישור קבלת הקבצים</h2>
              <p className="text-xs text-white/45">נדרש לפני תחילת ההורדה</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-sm leading-7 text-white/80" dir="rtl">
            {CONSENT_TEXT}
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-4 cursor-pointer">
            <Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} className="mt-1 border-[#FFD700] data-[state=checked]:bg-[#FFD700] data-[state=checked]:text-black" />
            <span className="text-sm leading-6 text-white/90">אני מאשר/ת את קבלת הקבצים, את תחילת ההורדה, ואת תנאי שמירת הגיבוי הזמני עד 90 יום.</span>
          </label>
          <Button onClick={onConfirm} disabled={!checked || busy} className="w-full h-14 text-lg rounded-2xl">
            {busy ? 'מכין ZIP להורדה...' : 'מאשר/ת ומוריד/ה ZIP מלא'}
          </Button>
          {progress && <p className="text-center text-sm font-bold text-[#FFD700] leading-6">{progress}</p>}
          {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm font-bold text-red-300">{error}</p>}
          {driveFolderUrl && (
            <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">
              <ExternalLink className="w-4 h-4" />
              פתיחת התיקייה ב-Google Drive
            </a>
          )}
          <p className="text-center text-xs text-white/45 leading-5">ההורדה תיפתח כקובץ ZIP אחד. לאחר ההורדה יש לפתוח/לחלץ את הקובץ כדי לראות את כל התמונות.</p>
        </div>
      </div>
    </div>
  );
}

export { CONSENT_TEXT };