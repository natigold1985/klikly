import React, { useMemo } from 'react';
import { CheckCircle2, DownloadCloud, Loader2 } from 'lucide-react';

export default function ThumbnailCarousel({
  files = [],
  busy = false,
  downloaded = false,
  placement = 'top',
  onDownload,
  onConfirmReminder,
}) {

  const thumbnails = useMemo(
    () => files.filter((file) => file.thumbnail_url || file.is_image).slice(0, 12),
    [files]
  );

  const startDownload = async () => {
    await onConfirmReminder?.();
    await onDownload();
  };

  return (
    <div className={`w-full ${placement === 'top' ? 'mb-8' : 'mt-8'}`} dir="rtl">
      <button
        onClick={startDownload}
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

    </div>
  );
}