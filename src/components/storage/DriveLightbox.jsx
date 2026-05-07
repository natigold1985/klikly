import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, FileText, Music } from 'lucide-react';

// Premium Pixieset-style lightbox for Drive files.
// - Smooth fade transitions between items
// - Keyboard navigation (Esc / ← / →)
// - Bottom thumbnail strip
// - Videos use Drive's preview iframe (no auto-download, native player)
// - Right-click & drag-to-save are disabled on images
export default function DriveLightbox({ files, startIndex = 0, onClose, onDownload }) {
  const [index, setIndex] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);

  const file = files[index];

  const next = useCallback(() => {
    setLoaded(false);
    setIndex((i) => (i + 1) % files.length);
  }, [files.length]);

  const prev = useCallback(() => {
    setLoaded(false);
    setIndex((i) => (i - 1 + files.length) % files.length);
  }, [files.length]);

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

  if (!file) return null;

  // Drive image high-res preview (s2400 ~= ample resolution; falls back to view_url)
  const fullImageSrc = file.thumbnail_url
    ? file.thumbnail_url.replace(/=s\d+/, '=s2400').replace(/sz=w\d+/, 'sz=w2400')
    : (file.view_url || file.download_url || null);

  // Drive video preview embed — uses Drive's native player, no auto-download
  const videoEmbedSrc = file.is_video ? `https://drive.google.com/file/d/${file.id}/preview` : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col" dir="ltr">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white/80 text-sm font-medium truncate max-w-[60%]">
          {index + 1} / {files.length}
          <span className="text-white/40 mx-3">·</span>
          <span className="text-white/60 truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDownload?.(file)}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          {file.view_url && (
            <a
              href={file.view_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="Open in Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Nav arrows */}
      {files.length > 1 && (
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
        className="flex-1 flex items-center justify-center p-4 md:p-12 relative"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {file.is_video ? (
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
            <iframe
              key={file.id}
              src={videoEmbedSrc}
              allow="autoplay"
              allowFullScreen
              className="w-full h-full"
              title={file.name}
            />
          </div>
        ) : file.is_audio ? (
          <div className="w-full max-w-xl bg-white/10 border border-white/15 rounded-2xl p-8 text-center">
            <Music className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <p className="text-white font-bold mb-4">{file.name}</p>
            <a href={file.view_url || file.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-bold">
              <ExternalLink className="w-4 h-4" /> פתח ב-Google Drive
            </a>
          </div>
        ) : file.is_document ? (
          <div className="w-full max-w-xl bg-white/10 border border-white/15 rounded-2xl p-8 text-center">
            <FileText className="w-16 h-16 text-blue-300 mx-auto mb-4" />
            <p className="text-white font-bold mb-4">{file.name}</p>
            <a href={file.view_url || file.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-bold">
              <ExternalLink className="w-4 h-4" /> פתח ב-Google Drive
            </a>
          </div>
        ) : (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
              </div>
            )}
            {fullImageSrc ? (
              <img
                key={file.id}
                src={fullImageSrc}
                alt={file.name}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className={`max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-300 select-none ${
                  loaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : (
              <div className="text-white/60 text-sm">No preview available</div>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div className="bg-black/70 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-min">
            {files.map((f, i) => (
              <button
                key={f.id}
                onClick={() => { setLoaded(false); setIndex(i); }}
                className={`relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  i === index ? 'border-[#FFD700] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {f.thumbnail_url ? (
                  <img src={f.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">
                    {f.is_video ? '▶' : f.is_audio ? '♪' : f.is_document ? 'PDF' : '·'}
                  </div>
                )}
                {f.is_video && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}