import React, { useState } from 'react';
import { Download, Play, FileImage, ExternalLink, Film, Image as ImageIcon } from 'lucide-react';

// Reusable grid for files fetched from Google Drive (zero-cost: thumbnails come from Drive).
// Used by both photographer (FileStorage) and client (MagicGallery).
export default function DriveFilesGrid({ files, onDownload, loading }) {
  const [filter, setFilter] = useState('all');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
      </div>
    );
  }

  if (!files?.length) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <FileImage className="w-14 h-14 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium text-lg">אין עדיין קבצים בתיקייה</p>
        <p className="text-slate-400 text-sm mt-1">העלה קבצים ישירות לתיקיית הפרויקט ב-Google Drive שלך</p>
      </div>
    );
  }

  const filtered = files.filter(f => {
    if (filter === 'photos') return f.is_image;
    if (filter === 'videos') return f.is_video;
    return true;
  });

  const stats = {
    total: files.length,
    images: files.filter(f => f.is_image).length,
    videos: files.filter(f => f.is_video).length,
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="text-sm text-slate-600">
          <span className="font-bold text-slate-900">{stats.total}</span> קבצים
          {stats.videos > 0 && (
            <span className="text-xs text-slate-400 mr-2">· {stats.images} תמונות, {stats.videos} סרטונים</span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>הכל</FilterTab>
          {stats.images > 0 && (
            <FilterTab active={filter === 'photos'} onClick={() => setFilter('photos')}>
              <ImageIcon className="w-3 h-3" /> תמונות
            </FilterTab>
          )}
          {stats.videos > 0 && (
            <FilterTab active={filter === 'videos'} onClick={() => setFilter('videos')}>
              <Film className="w-3 h-3" /> סרטונים
            </FilterTab>
          )}
        </div>
      </div>

      {/* Masonry */}
      <style>{`
        .drive-masonry { column-gap: 0.75rem; column-count: 2; }
        @media (min-width: 640px)  { .drive-masonry { column-count: 3; } }
        @media (min-width: 1024px) { .drive-masonry { column-count: 4; } }
        @media (min-width: 1536px) { .drive-masonry { column-count: 5; } }
        .drive-item { break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; }
      `}</style>
      <div className="drive-masonry">
        {filtered.map((f) => (
          <div
            key={f.id}
            className="drive-item mb-3 group relative rounded-xl overflow-hidden bg-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
          >
            {f.thumbnail_url ? (
              <img
                src={f.thumbnail_url}
                alt={f.name}
                loading="lazy"
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.03] select-none"
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            ) : (
              <div className="aspect-video bg-slate-200 flex items-center justify-center">
                {f.is_video ? <Play className="w-8 h-8 text-slate-400" /> : <FileImage className="w-8 h-8 text-slate-400" />}
              </div>
            )}

            {/* Play badge for videos */}
            {f.is_video && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
              <span className="text-white text-xs truncate flex-1 ml-2 drop-shadow">{f.name}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onDownload?.(f)}
                  className="w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-110 shadow-md transition-all"
                  title="הורדה"
                >
                  <Download className="w-4 h-4" />
                </button>
                {f.view_url && (
                  <a
                    href={f.view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 rounded-full bg-white/90 text-slate-900 flex items-center justify-center hover:scale-110 shadow-md transition-all"
                    title="צפייה ב-Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FilterTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}