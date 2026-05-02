import React, { useState, useMemo } from 'react';
import { FileImage, Play, Download, Trash2, Image as ImageIcon, Film } from 'lucide-react';
import PixiesetLightbox from './PixiesetLightbox';

function isVideo(url = '') {
  return /\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(url);
}

// Disable right-click & drag-save on media (basic protection — not bulletproof but stops casual saving)
const protectMedia = {
  onContextMenu: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
  draggable: false,
};

// Pixieset-inspired masonry gallery with filter, lightbox, and improved UX.
export default function PixiesetGallery({ photos, loading, canDelete, onDelete, onDownload }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [filter, setFilter] = useState('all'); // all | photos | videos

  const filtered = useMemo(() => {
    if (filter === 'photos') return photos.filter(p => !isVideo(p.file_url));
    if (filter === 'videos') return photos.filter(p => isVideo(p.file_url));
    return photos;
  }, [photos, filter]);

  const stats = useMemo(() => {
    const videos = photos.filter(p => isVideo(p.file_url)).length;
    return { total: photos.length, videos, images: photos.length - videos };
  }, [photos]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
      </div>
    );
  }

  if (!photos?.length) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <FileImage className="w-14 h-14 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium text-lg">אין קבצים בגלריה</p>
      </div>
    );
  }

  return (
    <>
      {/* Header bar with filter + count */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-bold text-slate-900">{stats.total}</span>
          <span>קבצים</span>
          {stats.videos > 0 && (
            <span className="text-xs text-slate-400">· {stats.images} תמונות, {stats.videos} סרטונים</span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            הכל
          </button>
          {stats.images > 0 && (
            <button
              onClick={() => setFilter('photos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filter === 'photos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ImageIcon className="w-3 h-3" />
              תמונות
            </button>
          )}
          {stats.videos > 0 && (
            <button
              onClick={() => setFilter('videos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filter === 'videos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Film className="w-3 h-3" />
              סרטונים
            </button>
          )}
        </div>
      </div>

      {/* Masonry */}
      <style>{`
        .pixie-masonry { column-gap: 0.75rem; column-count: 2; }
        @media (min-width: 640px)  { .pixie-masonry { column-count: 3; } }
        @media (min-width: 1024px) { .pixie-masonry { column-count: 4; } }
        @media (min-width: 1536px) { .pixie-masonry { column-count: 5; } }
        .pixie-item { break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; }
      `}</style>
      <div className="pixie-masonry">
        {filtered.map((photo, idx) => {
          const video = isVideo(photo.file_url);
          return (
            <div
              key={photo.id}
              className="pixie-item mb-3 group relative rounded-xl overflow-hidden bg-slate-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
              onClick={() => setLightboxIndex(idx)}
            >
              {video ? (
                <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                  {/* Use poster only — no auto-stream of video, saves bandwidth */}
                  <video
                    src={photo.file_url + '#t=0.5'}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                    {...protectMedia}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/0 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-slate-900 fill-current ml-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={photo.thumbnail_url || photo.file_url}
                  alt={photo.file_name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.03] select-none"
                  {...protectMedia}
                />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3 pointer-events-none">
                <span className="text-white text-xs truncate flex-1 ml-2 drop-shadow">{photo.file_name}</span>
                <div className="flex gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onDownload?.(photo)}
                    className="w-8 h-8 rounded-full bg-white/95 text-slate-900 flex items-center justify-center hover:bg-white hover:scale-110 shadow-md transition-all"
                    title="הורדה"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => onDelete?.(photo.id)}
                      className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 hover:scale-110 shadow-md transition-all"
                      title="מחיקה"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <PixiesetLightbox
          photos={filtered}
          startIndex={lightboxIndex}
          canDelete={canDelete}
          onDownload={onDownload}
          onDelete={(id) => { onDelete?.(id); setLightboxIndex(null); }}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}