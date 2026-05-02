import React, { useState } from 'react';
import { FileImage, Play, Download, Trash2 } from 'lucide-react';
import PixiesetLightbox from './PixiesetLightbox';

function isVideo(url = '') {
  return /\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(url);
}

// Pixieset-inspired masonry gallery — alternating row heights for a magazine feel.
// Items flow into rows; we use CSS columns for masonry-like layout that's reliable cross-browser.
export default function PixiesetGallery({ photos, loading, canDelete, onDelete, onDownload }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

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
      {/* Masonry via CSS columns */}
      <div
        className="gap-3 [column-fill:_balance]"
        style={{ columnCount: 'var(--cols, 4)' }}
      >
        <style>{`
          @media (max-width: 1280px) { .pixie-masonry { --cols: 4; } }
          @media (max-width: 1024px) { .pixie-masonry { --cols: 3; } }
          @media (max-width: 640px)  { .pixie-masonry { --cols: 2; } }
        `}</style>
        <div className="pixie-masonry" style={{ columnCount: 'var(--cols, 4)', columnGap: '0.75rem' }}>
          {photos.map((photo, idx) => {
            const video = isVideo(photo.file_url);
            return (
              <div
                key={photo.id}
                className="mb-3 break-inside-avoid group relative rounded-xl overflow-hidden bg-slate-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
                onClick={() => setLightboxIndex(idx)}
              >
                {video ? (
                  <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                    <video
                      src={photo.file_url}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover opacity-70"
                      onMouseEnter={(e) => { try { e.currentTarget.play(); } catch (_) {} }}
                      onMouseLeave={(e) => { try { e.currentTarget.pause(); e.currentTarget.currentTime = 0; } catch (_) {} }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-slate-900 fill-current ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.thumbnail_url || photo.file_url}
                    alt={photo.file_name}
                    loading="lazy"
                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                  <span className="text-white text-xs truncate flex-1 ml-2">{photo.file_name}</span>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onDownload?.(photo)}
                      className="w-8 h-8 rounded-full bg-white/95 text-slate-900 flex items-center justify-center hover:bg-white shadow-md"
                      title="הורדה"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => onDelete?.(photo.id)}
                        className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-md"
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
      </div>

      {lightboxIndex !== null && (
        <PixiesetLightbox
          photos={photos}
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