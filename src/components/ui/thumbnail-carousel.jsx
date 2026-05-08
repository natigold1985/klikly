import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, DownloadCloud, Loader2 } from 'lucide-react';

const FALLBACK_ITEMS = [
  {
    id: 'fallback-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=800&fit=crop',
    name: 'Studio Gold Gallery Preview',
    is_image: true,
  },
  {
    id: 'fallback-2',
    thumbnail_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    name: 'Studio Gold Gallery Preview',
    is_image: true,
  },
  {
    id: 'fallback-3',
    thumbnail_url: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=1200&h=800&fit=crop',
    name: 'Studio Gold Gallery Preview',
    is_image: true,
  },
];

const FULL_WIDTH_PX = 120;
const COLLAPSED_WIDTH_PX = 35;
const GAP_PX = 2;
const MARGIN_PX = 2;

function Thumbnails({ items, index, setIndex }) {
  const thumbnailsRef = useRef(null);

  useEffect(() => {
    if (!thumbnailsRef.current) return;
    let scrollPosition = 0;
    for (let i = 0; i < index; i += 1) scrollPosition += COLLAPSED_WIDTH_PX + GAP_PX;
    scrollPosition += MARGIN_PX;
    const containerWidth = thumbnailsRef.current.offsetWidth;
    const centerOffset = containerWidth / 2 - FULL_WIDTH_PX / 2;
    thumbnailsRef.current.scrollTo({ left: scrollPosition - centerOffset, behavior: 'smooth' });
  }, [index]);

  return (
    <div ref={thumbnailsRef} className="overflow-x-auto touch-pan-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`.overflow-x-auto::-webkit-scrollbar { display: none; }`}</style>
      <div className="flex gap-0.5 h-20 pb-2" style={{ width: 'fit-content' }}>
        {items.map((item, i) => (
          <motion.button
            key={item.id || item.name || i}
            onClick={() => setIndex(i)}
            initial={false}
            animate={i === index ? 'active' : 'inactive'}
            variants={{
              active: { width: FULL_WIDTH_PX, marginLeft: MARGIN_PX, marginRight: MARGIN_PX },
              inactive: { width: COLLAPSED_WIDTH_PX, marginLeft: 0, marginRight: 0 },
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative shrink-0 h-full overflow-hidden rounded-md border border-white/10 bg-white/10"
            aria-label={item.name || `תמונה ${i + 1}`}
          >
            <img src={item.thumbnail_url} alt={item.name || ''} className="w-full h-full object-cover pointer-events-none select-none" draggable={false} loading="lazy" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default function ThumbnailCarousel({ files = [], busy = false, downloaded = false, onDownload, showDownloadButton = true }) {
  const items = useMemo(() => {
    const mapped = files
      .filter((file) => file.thumbnail_url || file.is_image)
      .map((file) => ({ ...file, thumbnail_url: file.thumbnail_url || file.view_url }))
      .filter((file) => file.thumbnail_url);
    return mapped.length ? mapped : FALLBACK_ITEMS;
  }, [files]);

  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const x = useMotionValue(0);

  useEffect(() => {
    if (!isDragging && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth || 1;
      animate(x, -index * containerWidth, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [index, x, isDragging]);

  const startDownload = async () => {
    await onDownload?.();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-0 md:p-4" dir="rtl">
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0a0a0a] border border-[#FFD700]/20 shadow-[0_0_45px_rgba(255,215,0,0.18)]" ref={containerRef}>
          <motion.div
            className="flex"
            drag="x"
            dragElastic={0.2}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(event, info) => {
              setIsDragging(false);
              const containerWidth = containerRef.current?.offsetWidth || 1;
              const offset = info.offset.x;
              const velocity = info.velocity.x;
              let newIndex = index;
              if (Math.abs(velocity) > 500) newIndex = velocity > 0 ? index - 1 : index + 1;
              else if (Math.abs(offset) > containerWidth * 0.3) newIndex = offset > 0 ? index - 1 : index + 1;
              setIndex(Math.max(0, Math.min(items.length - 1, newIndex)));
            }}
            style={{ x }}
          >
            {items.map((item, i) => (
              <div key={item.id || item.name || i} className="shrink-0 w-full h-[310px] sm:h-[430px] md:h-[520px] bg-black">
                {item.is_video ? (
                  <video src={item.view_url || item.thumbnail_url} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <img src={item.thumbnail_url} alt={item.name || ''} className="w-full h-full object-cover select-none pointer-events-none" draggable={false} />
                )}
              </div>
            ))}
          </motion.div>

          <button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-black flex items-center justify-center shadow-lg disabled:opacity-35 hover:scale-105 transition z-10" aria-label="הקודם">
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button disabled={index === items.length - 1} onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-black flex items-center justify-center shadow-lg disabled:opacity-35 hover:scale-105 transition z-10" aria-label="הבא">
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm border border-white/10">
            {index + 1} / {items.length}
          </div>
        </div>

        <Thumbnails items={items} index={index} setIndex={setIndex} />

        {showDownloadButton && (
          <button
            onClick={startDownload}
            disabled={busy}
            className="group relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#FFD700] via-[#FFF1A8] to-[#D4AF37] px-8 py-7 md:py-8 text-black shadow-[0_0_55px_rgba(255,215,0,0.45)] hover:shadow-[0_0_85px_rgba(255,215,0,0.75)] active:scale-[0.985] transition-all disabled:opacity-70"
          >
            <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 text-center">
              {busy ? <Loader2 className="w-10 h-10 animate-spin" /> : downloaded ? <CheckCircle2 className="w-10 h-10" /> : <DownloadCloud className="w-12 h-12" />}
              <div className="leading-tight text-center md:text-right">
                <div className="text-3xl md:text-5xl font-black tracking-tight">הורדת כל הקבצים</div>
                <div className="text-sm md:text-base font-bold mt-2 opacity-75">לחיצה אחת ומתחילה הורדת ZIP מלאה</div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}