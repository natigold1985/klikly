import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Play, FileImage, ExternalLink, Film, Image as ImageIcon, Video as VideoIcon, DownloadCloud, Loader2 } from 'lucide-react';
import DriveLightbox from './DriveLightbox';

// Pixieset-style premium gallery grid for Drive files.
// - Masonry layout (CSS columns) for elegant photo flow
// - Smooth fade transitions between filter tabs
// - Real Drive video thumbnails (via thumbnailLink) with subtle play overlay
// - Click does NOT auto-play; videos open in a new tab on download/view action only
export default function DriveFilesGrid({ files, onDownload, onDownloadAll, loading }) {
  const [filter, setFilter] = useState('all');
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const stats = useMemo(() => ({
    total: files?.length || 0,
    images: files?.filter((f) => f.is_image).length || 0,
    videos: files?.filter((f) => f.is_video).length || 0,
  }), [files]);

  const filtered = useMemo(() => {
    if (!files) return [];
    if (filter === 'photos') return files.filter((f) => f.is_image);
    if (filter === 'videos') return files.filter((f) => f.is_video);
    return files;
  }, [files, filter]);

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
        <p className="text-slate-400 text-sm mt-1">העלה קבצים — והם יופיעו כאן באופן אוטומטי</p>
      </div>
    );
  }

  return (
    <>
      {/* Header / Filters / Download All */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="text-sm text-slate-600">
          <span className="font-bold text-slate-900 text-lg">{stats.total}</span>
          <span className="mr-1">קבצים</span>
          {(stats.images > 0 || stats.videos > 0) && (
            <span className="text-xs text-slate-400 mr-2">
              · {stats.images} תמונות, {stats.videos} סרטונים
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
              הכל
            </FilterTab>
            {stats.images > 0 && (
              <FilterTab active={filter === 'photos'} onClick={() => setFilter('photos')}>
                <ImageIcon className="w-3.5 h-3.5" /> תמונות
              </FilterTab>
            )}
            {stats.videos > 0 && (
              <FilterTab active={filter === 'videos'} onClick={() => setFilter('videos')}>
                <Film className="w-3.5 h-3.5" /> סרטונים
              </FilterTab>
            )}
          </div>
          {onDownloadAll && filtered.length > 0 && (
            <button
              onClick={async () => {
                setBulkDownloading(true);
                try {
                  await onDownloadAll(filtered, filter);
                } finally {
                  setTimeout(() => setBulkDownloading(false), 1500);
                }
              }}
              disabled={bulkDownloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E0B82A] text-black font-bold text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-95 transition-all disabled:opacity-60"
            >
              {bulkDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              הורד הכל ({filtered.length})
            </button>
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

      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          className="drive-masonry"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {filtered.map((f, i) => (
            <FileTile
              key={f.id}
              file={f}
              onDownload={onDownload}
              onOpen={() => setLightboxIndex(i)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {lightboxIndex !== null && (
        <DriveLightbox
          files={filtered}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownload={onDownload}
        />
      )}
    </>
  );
}

function FileTile({ file, onDownload, onOpen }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const showThumb = file.thumbnail_url && !imgFailed;
  const isVideo = file.is_video;

  const formatDuration = (ms) => {
    if (!ms) return null;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onOpen}
      className="drive-item mb-3 group relative rounded-2xl overflow-hidden bg-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 cursor-zoom-in"
    >
      {showThumb ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse" />
          )}
          <img
            src={file.thumbnail_url}
            alt={file.name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={`w-full h-auto object-cover transition-all duration-700 select-none ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } group-hover:scale-[1.04]`}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />
        </>
      ) : (
        // Fallback when no thumbnail: elegant placeholder
        <div className={`flex items-center justify-center bg-gradient-to-br ${
          isVideo ? 'from-slate-800 to-slate-900' : 'from-slate-200 to-slate-300'
        }`} style={{ aspectRatio: '4/3' }}>
          {isVideo ? (
            <VideoIcon className="w-12 h-12 text-white/60" />
          ) : (
            <FileImage className="w-12 h-12 text-slate-400" />
          )}
        </div>
      )}

      {/* Subtle video indicator (NOT a play button — videos don't auto-play on click) */}
      {isVideo && (
        <>
          {/* Top-right chip */}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm pointer-events-none">
            <Play className="w-3 h-3 text-white fill-white" />
            <span className="text-[10px] font-bold text-white tracking-wide">
              {formatDuration(file.video_duration_ms) || 'וידאו'}
            </span>
          </div>
          {/* Center play glyph (decorative) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg opacity-90 group-hover:scale-110 transition-transform duration-300">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        </>
      )}

      {/* Hover overlay with actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3 pointer-events-none">
        <span className="text-white text-xs truncate flex-1 ml-2 drop-shadow font-medium">
          {file.name}
        </span>
        <div className="flex gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(file);
            }}
            className="w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-110 shadow-md transition-all"
            title="הורדה"
          >
            <Download className="w-4 h-4" />
          </button>
          {file.view_url && (
            <a
              href={file.view_url}
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
  );
}

function FilterTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
        active
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}