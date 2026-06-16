import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ThumbnailCarousel from '@/components/ui/thumbnail-carousel';
import ConsentDownloadDialog from '@/components/gallery/ConsentDownloadDialog';
import StickyDownloadButton from '@/components/gallery/StickyDownloadButton';
import { Loader2, ShieldOff } from 'lucide-react';

function saveBase64File(base64, fileName, mimeType = 'application/octet-stream') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function FolderGallery() {
  const { folderId } = useParams();
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [videoUrls, setVideoUrls] = useState({});
  const firstFetchRef = useRef(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['folderGallery', folderId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFolderFiles', { folder_id: folderId, track_open: firstFetchRef.current });
      firstFetchRef.current = false;
      return res.data;
    },
    enabled: !!folderId,
    refetchInterval: 10000,
    retry: false,
  });

  const handleConfirmDownload = async () => {
    setBusy(true);
    await base44.functions.invoke('trackFolderDelivery', {
      folder_id: folderId,
      action_type: 'download_confirmed',
      file_count: data?.files?.length || 0,
    });
    const zip = await base44.functions.invoke('downloadFolderZip', { folder_id: folderId });
    await base44.functions.invoke('trackFolderDelivery', {
      folder_id: folderId,
      action_type: 'download_started',
      file_count: zip.data.file_count || data?.files?.length || 0,
    });
    saveBase64File(zip.data.base64, zip.data.name || 'studio-gold-gallery.zip', 'application/zip');
    await base44.functions.invoke('trackFolderDelivery', {
      folder_id: folderId,
      action_type: 'download_completed',
      file_count: zip.data.file_count || data?.files?.length || 0,
    });
    setDownloaded(true);
    setBusy(false);
    setConsentOpen(false);
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const loadVideos = async () => {
      const videos = (data?.files || []).filter((file) => file.is_video && !videoUrls[file.id]);
      for (const file of videos.slice(0, 3)) {
        const res = await base44.functions.invoke('downloadFolderFile', { folder_id: folderId, file_id: file.id });
        const byteCharacters = atob(res.data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: res.data.mime_type || 'video/mp4' });
        setVideoUrls((prev) => ({ ...prev, [file.id]: URL.createObjectURL(blob) }));
      }
    };
    if (data?.files?.some((file) => file.is_video)) loadVideos();
  }, [data?.files, folderId]);

  if (isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-9 h-9 text-[#FFD700] animate-spin" /></div>;
  }

  if (error || !data?.project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[#0a0a0a] border border-red-500/30 rounded-3xl p-8 text-center max-w-md text-white">
          <ShieldOff className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">הגלריה לא זמינה</h1>
          <p className="text-white/60 text-sm">הקישור לא נמצא או שתוקפו פג.</p>
        </div>
      </div>
    );
  }

  const { project, files = [] } = data;
  const galleryFiles = files.map((file) => file.is_video && videoUrls[file.id] ? { ...file, view_url: videoUrls[file.id] } : file);

  return (
    <div className="min-h-screen bg-black text-white font-sans" dir="rtl">
      <StickyDownloadButton position="top" busy={busy} fileCount={files.length} onClick={() => setConsentOpen(true)} />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-8 md:py-14">
        <div className="text-center mb-10">
          <img src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" alt="KLIKLY" className="h-12 md:h-16 mx-auto mb-8 object-contain drop-shadow-[0_0_18px_rgba(255,215,0,0.55)]" />
          <p className="text-xs uppercase tracking-[0.4em] text-[#FFD700]/70 mb-3">Studio Gold Delivery Portal</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-3">{project.client_name}</h1>
          <p className="text-white/55 text-base md:text-xl">{project.project_name}</p>
          {downloaded && <p className="mt-4 text-emerald-400 font-bold">✓ ההורדה החלה והאישור נשמר</p>}
        </div>

        <ThumbnailCarousel files={galleryFiles} busy={busy} downloaded={downloaded} showDownloadButton={false} />

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">{files.length}</div><div className="text-xs text-white/45">קבצים זמינים</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">90</div><div className="text-xs text-white/45">ימי שמירה</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">ZIP</div><div className="text-xs text-white/45">הורדה מרוכזת</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">LIVE</div><div className="text-xs text-white/45">סנכרון Drive</div></div>
        </div>
      </main>

      <StickyDownloadButton position="bottom" busy={busy} fileCount={files.length} onClick={() => setConsentOpen(true)} />
      <ConsentDownloadDialog open={consentOpen} busy={busy} onClose={() => setConsentOpen(false)} onConfirm={handleConfirmDownload} />
    </div>
  );
}