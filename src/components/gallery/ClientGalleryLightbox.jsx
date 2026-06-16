import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart, MessageSquare, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const photoSrc = (photo) => photo?.file_url || photo?.url || photo?.view_url || photo?.thumbnail_url || photo?.thumbnail;
const thumbSrc = (photo) => photo?.thumbnail_url || photo?.thumbnail || photoSrc(photo);

export default function ClientGalleryLightbox({ photos, index, setIndex, onClose, selectedIds, toggleSelection, photoComments, setPhotoComments }) {
  const [touchStart, setTouchStart] = useState(null);
  const activeThumbRef = useRef(null);
  const photo = photos[index];
  const isSelected = selectedIds.has(photo?.id);

  const prev = () => setIndex((index - 1 + photos.length) % photos.length);
  const next = () => setIndex((index + 1) % photos.length);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') next();
      if (event.key === 'ArrowRight') prev();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [index, photos.length]);

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);

  const handleTouchEnd = (event) => {
    if (touchStart === null) return;
    const delta = (event.changedTouches?.[0]?.clientX || touchStart) - touchStart;
    setTouchStart(null);
    if (Math.abs(delta) < 45) return;
    if (delta > 0) prev();
    else next();
  };

  if (!photo) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col" dir="rtl">
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-3 p-3 md:p-5 bg-gradient-to-b from-black/80 to-transparent" dir="ltr">
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
          <div className="text-white/80 text-sm font-bold bg-black/40 border border-white/10 rounded-full px-3 py-1.5">{index + 1} / {photos.length}</div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[1fr_340px] lg:grid-rows-1 gap-0 pt-16 pb-24 lg:pb-4">
          <div className="relative flex items-center justify-center p-2 md:p-6 touch-pan-y" onTouchStart={(e) => setTouchStart(e.touches?.[0]?.clientX ?? null)} onTouchEnd={handleTouchEnd} dir="ltr">
            <button onClick={prev} className="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/12 hover:bg-white/25 text-white items-center justify-center z-10" aria-label="הקודם"><ChevronLeft className="w-7 h-7" /></button>
            <img src={photoSrc(photo)} alt={photo.file_name || 'תמונה'} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none" draggable={false} loading="eager" decoding="async" />
            <button onClick={next} className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/12 hover:bg-white/25 text-white items-center justify-center z-10" aria-label="הבא"><ChevronRight className="w-7 h-7" /></button>
          </div>

          <aside className="lg:my-4 lg:ml-4 mx-3 lg:mx-0 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-4 max-h-[42vh] lg:max-h-none overflow-y-auto">
            <h3 className="text-lg font-black text-[#FFD700]">פעולות לתמונה</h3>
            <button onClick={() => toggleSelection(photo.id)} className={`w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl transition-all active:scale-95 border ${isSelected ? 'bg-[#FFD700] text-black border-[#FFD700]' : 'bg-white/5 text-white hover:bg-white/10 border-white/10'}`}>
              <Heart className={`w-5 h-5 ${isSelected ? 'fill-black' : ''}`} />
              <span className="font-bold text-base md:text-lg">{isSelected ? 'נבחרה' : 'סמן כמועדפת'}</span>
            </button>
            {isSelected && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> הערות לעריכה</label>
                <Textarea placeholder="למשל: אפשר להבהיר קצת?" value={photoComments[photo.id] || ''} onChange={(e) => setPhotoComments({ ...photoComments, [photo.id]: e.target.value })} className="bg-white/5 border-white/10 text-white min-h-[90px] resize-none focus-visible:ring-[#FFD700]" />
              </div>
            )}
          </aside>
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-black/85 border-t border-white/10 px-3 py-3 overflow-x-auto" dir="ltr" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 min-w-max">
            {photos.map((item, i) => (
              <button key={item.id} ref={i === index ? activeThumbRef : null} onClick={() => setIndex(i)} className={`relative h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden border-2 shrink-0 ${i === index ? 'border-[#FFD700]' : 'border-white/10 opacity-60 hover:opacity-100'}`}>
                <img src={thumbSrc(item)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                {selectedIds.has(item.id) && <div className="absolute inset-0 bg-[#FFD700]/25 flex items-center justify-center"><Heart className="w-5 h-5 text-[#FFD700] fill-[#FFD700]" /></div>}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}