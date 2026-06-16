import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, DownloadCloud, Loader2, Play } from 'lucide-react';

const FALLBACK_ITEMS = [
  {
    id: 'fallback-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=800&fit=crop',
    name: 'Studio Gold Gallery Preview',
    is_image: true,
  },
];

function normalizeItems(files = []) {
  const mapped = files
    .filter((file) => file.thumbnail_url || file.view_url || file.download_url || file.is_image)
    .map((file) => ({
      ...file,
      image_src: file.thumbnail_url || file.view_url || file.download_url,
      display_name: file.name || file.file_name || 'תמונה',
    }))
    .filter((file) => file.image_src || file.is_video);
  return mapped.length ? mapped : FALLBACK_ITEMS;
}

function Thumbnails({ items, index, setIndex }) {
  const thumbnailsRef = useRef(null);

  useEffect(() => {
    const active = thumbnailsRef.current?.querySelector(`[data-thumb-index="${index}"]`);
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);

  return (
    <div ref={thumbnailsRef} className="gallery-thumbs-scroll overflow-x-auto touch-pan-x px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} dir="ltr">
      <style>{`.gallery-thumbs-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="gallery-thumbs-scroll flex gap-2 h-16 md:h-20 pb-2 min-w-max">
        {items.map((item, i) => (
          <button
            key={item.id || item.display_name || i}
            data-thumb-index={i}
            onClick={() => setIndex(i)}
            className={`relative shrink-0 h-full w-16 md:w-20 overflow-hidden rounded-xl border-2 bg-white/10 transition-[border-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
              i === index ? 'border-[#FFD700] opacity-100' : 'border-white/10 opacity-55 hover:opacity-90'
            }`}
            aria-label={`פתח תמונה ${i + 1}`}
          >
            {item.is_video ? (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : null}
                <Play className="absolute w-5 h-5 text-white fill-white" />
              </div>
            ) : (
              <img src={item.image_src} alt="" className="w-full h-full object-cover" draggable={false} loading="lazy" decoding="async" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ThumbnailCarousel({ files = [], busy = false, downloaded = false, onDownload, showDownloadButton = true }) {
  const items = useMemo(() => normalizeItems(files), [files]);
  const [index, setIndex] = useState(0);
  const touchStartRef = useRef(null);
  const current = items[index] || items[0];

  useEffect(() => {
    setIndex((currentIndex) => Math.min(currentIndex, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    const nextItem = items[index + 1];
    if (!nextItem?.image_src || nextItem.is_video) return;
    const img = new Image();
    img.src = nextItem.image_src;
  }, [items, index]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  const handleTouchStart = (event) => {
    touchStartRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartRef.current === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartRef.current;
    const delta = endX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) < 45) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-0 md:p-4 font-sans" dir="rtl">
      <div className="flex flex-col gap-4">
        <div
          className="relative overflow-hidden rounded-3xl bg-[#050505] border border-[#FFD700]/20 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          dir="ltr"
        >
          <div className="relative w-full h-[58vh] min-h-[300px] max-h-[760px] bg-black flex items-center justify-center">
            {current?.is_video ? (
              <video
                key={current.id || index}
                src={current.view_url || current.download_url || current.image_src}
                poster={current.thumbnail_url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                key={current?.id || index}
                src={current?.image_src}
                alt={current?.display_name || ''}
                className="w-full h-full object-contain select-none"
                draggable={false}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                decoding="async"
              />
            )}
          </div>

          {items.length > 1 && (
            <>
              <button
                disabled={index === 0}
                onClick={goPrev}
                className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg disabled:opacity-35 hover:bg-white transition-colors z-10"
                aria-label="הקודם"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                disabled={index === items.length - 1}
                onClick={goNext}
                className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg disabled:opacity-35 hover:bg-white transition-colors z-10"
                aria-label="הבא"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm border border-white/10 tabular-nums">
            {index + 1} / {items.length}
          </div>
        </div>

        {items.length > 1 && <Thumbnails items={items} index={index} setIndex={setIndex} />}

        {showDownloadButton && (
          <button
            onClick={() => onDownload?.()}
            disabled={busy}
            className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFD700] via-[#FFF1A8] to-[#D4AF37] px-6 py-5 md:px-8 md:py-7 text-black shadow-[0_18px_55px_rgba(255,215,0,0.28)] hover:brightness-105 transition-[filter,box-shadow] disabled:opacity-70"
          >
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
              {busy ? <Loader2 className="w-9 h-9 animate-spin" /> : downloaded ? <CheckCircle2 className="w-9 h-9" /> : <DownloadCloud className="w-10 h-10" />}
              <div className="leading-tight text-center sm:text-right">
                <div className="text-2xl md:text-4xl font-black tracking-tight">הורדת כל הקבצים</div>
                <div className="text-sm md:text-base font-bold mt-1 opacity-75">לחיצה אחת ומתחילה הורדת ZIP מלאה</div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}