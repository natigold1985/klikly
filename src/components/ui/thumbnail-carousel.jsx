import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, DownloadCloud, Loader2, X } from 'lucide-react';

export default function ThumbnailCarousel({
  files = [],
  busy = false,
  downloaded = false,
  placement = 'top',
  onDownload,
  onConfirmReminder,
}) {
  const [open, setOpen] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);

  const thumbnails = useMemo(
    () => files.filter((file) => file.thumbnail_url || file.is_image).slice(0, 12),
    [files]
  );

  const startDownload = async () => {
    await onDownload();
    setOpen(false);
  };

  const confirmReminder = async () => {
    setSavingConsent(true);
    await onConfirmReminder?.();
    setConsentSaved(true);
    setSavingConsent(false);
    await startDownload();
  };

  return (
    <div className={`w-full ${placement === 'top' ? 'mb-8' : 'mt-8'}`} dir="rtl">
      <button
        onClick={() => (consentSaved ? startDownload() : setOpen(true))}
        disabled={busy}
        className="group relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#FFD700] via-[#FFF1A8] to-[#D4AF37] px-8 py-7 md:py-9 text-black shadow-[0_0_55px_rgba(255,215,0,0.45)] hover:shadow-[0_0_85px_rgba(255,215,0,0.75)] active:scale-[0.985] transition-all disabled:opacity-70"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 text-center">
          {busy ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : downloaded ? (
            <CheckCircle2 className="w-10 h-10" />
          ) : (
            <DownloadCloud className="w-12 h-12" />
          )}
          <div className="leading-tight text-center md:text-right">
            <div className="text-3xl md:text-5xl font-black tracking-tight">הורד הכל</div>
            <div className="text-sm md:text-base font-bold mt-2 opacity-75">פתח את כל גלריית הזיכרונות שלך עכשיו</div>
          </div>
        </div>
      </button>

      {thumbnails.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 justify-start md:justify-center">
          {thumbnails.map((file) => (
            <div key={file.id || file.name} className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white/10">
              {file.thumbnail_url ? (
                <img src={file.thumbnail_url} alt={file.name || ''} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full bg-[#FFD700]/20" />
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-right text-slate-950 shadow-2xl" dir="rtl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#FFD700] flex items-center justify-center">
                  <Bell className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-black">תזכורת לשמירת הקבצים</h2>
                  <p className="text-xs text-slate-500 mt-1">אפשר להמשיך להורדה בכל מקרה</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="סגור">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-base font-bold text-slate-800 mb-2" dir="ltr">
              Would you like a reminder to ensure you've saved all your memories?
            </p>
            <p className="text-sm text-slate-500 mb-6">נשלח תזכורת באימייל ונכין תזכורת WhatsApp אם לא סומן שהכול נשמר.</p>

            <div className="grid gap-3">
              <button
                onClick={confirmReminder}
                disabled={savingConsent}
                className="h-13 rounded-2xl bg-black text-white font-black flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingConsent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                כן, הזכירו לי והמשיכו להורדה
              </button>
              <button
                onClick={startDownload}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-bold"
              >
                לא תודה, המשיכו להורדה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}