import React from 'react';
import { DownloadCloud, Loader2, ShieldCheck } from 'lucide-react';

export default function StickyDownloadButton({ position = 'top', busy = false, fileCount = 0, onClick }) {
  const placement = position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t';
  return (
    <div className={`sticky ${placement} z-40 bg-black/85 backdrop-blur-2xl border-[#FFD700]/25 px-3 py-3`} dir="rtl">
      <button
        onClick={onClick}
        disabled={busy}
        className="mx-auto flex w-full max-w-5xl items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFD700] via-[#FFF1A8] to-[#D4AF37] px-5 py-4 text-black shadow-[0_0_45px_rgba(255,215,0,0.45)] active:scale-[0.99] transition disabled:opacity-70"
      >
        {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <DownloadCloud className="w-8 h-8" />}
        <div className="text-right leading-tight">
          <div className="text-xl md:text-3xl font-black">הורדת כל הקבצים</div>
          <div className="flex items-center gap-1 text-xs md:text-sm font-bold opacity-75">
            <ShieldCheck className="w-4 h-4" /> אישור קבלת קבצים {fileCount ? `· ${fileCount} קבצים` : ''}
          </div>
        </div>
      </button>
    </div>
  );
}