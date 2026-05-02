import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';

function isVideo(url = '') {
  return /\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(url);
}

export default function PixiesetLightbox({ photos, startIndex = 0, onClose, onDownload, onDelete, canDelete }) {
  const [index, setIndex] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);

  const photo = photos[index];

  const next = useCallback(() => {
    setLoaded(false);
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  const prev = useCallback(() => {
    setLoaded(false);
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') next();
      if (e.key === 'ArrowRight') prev();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [next, prev, onClose]);

  if (!photo) return null;
  const video = isVideo(photo.file_url);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col" dir="ltr">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white/80 text-sm font-medium">
          {index + 1} / {photos.length}
          <span className="text-white/40 mx-3">·</span>
          <span className="text-white/60">{photo.file_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload?.(photo)}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="הורדה"
          >
            <Download className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete?.(photo.id)}
              className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
              title="מחיקה"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="סגירה"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Media */}
      <div
        className="flex-1 flex items-center justify-center p-4 md:p-12"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {video ? (
          <video
            key={photo.id}
            src={photo.file_url}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg shadow-2xl"
            onLoadedData={() => setLoaded(true)}
          />
        ) : (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <img
              key={photo.id}
              src={photo.file_url}
              alt={photo.file_name}
              onLoad={() => setLoaded(true)}
              className={`max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {photos.length > 1 && (
        <div className="bg-black/70 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-min">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => { setLoaded(false); setIndex(i); }}
                className={`relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  i === index ? 'border-[#FFD700] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {isVideo(p.file_url) ? (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">▶</div>
                ) : (
                  <img src={p.thumbnail_url || p.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}