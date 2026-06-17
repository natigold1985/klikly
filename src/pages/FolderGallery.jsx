import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ConsentDownloadDialog from '@/components/gallery/ConsentDownloadDialog';
import StickyDownloadButton from '@/components/gallery/StickyDownloadButton';
import { Loader2, ShieldOff } from 'lucide-react';

function triggerDownload(url, fileName = '') {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  if (fileName) a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function FolderGallery() {
  const { folderId } = useParams();
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadError, setDownloadError] = useState('');
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
    const filesToDownload = data?.files || [];
    if (!filesToDownload.length) return;
    setBusy(true);
    setDownloadError('');
    setDownloadProgress('מכין קובץ ZIP להורדה...');

    try {
      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_confirmed',
        file_count: filesToDownload.length,
        download_mode: 'zip',
      });
      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_started',
        file_count: filesToDownload.length,
        download_mode: 'zip',
      });

      const zipResponse = await base44.functions.fetch('/downloadFolderZip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!zipResponse.ok) {
        const errorData = await zipResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'שגיאה בהכנת קובץ ה-ZIP');
      }

      const blob = await zipResponse.blob();
      const zipName = decodeURIComponent(zipResponse.headers.get('X-File-Name') || '') || `${project.project_name || 'studio-gold-gallery'}.zip`;
      const fileCount = Number(zipResponse.headers.get('X-File-Count') || filesToDownload.length);
      const zipUrl = URL.createObjectURL(blob);
      triggerDownload(zipUrl, zipName);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);

      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_completed',
        file_count: fileCount,
        download_mode: 'zip',
      });
      setDownloaded(true);
      setDownloadProgress('קובץ ה-ZIP ירד למחשב והפעולה נרשמה בלוג.');
      setConsentOpen(false);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'שגיאה בהכנת ההורדה';
      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_failed',
        file_count: filesToDownload.length,
        download_mode: 'zip',
        error_message: message,
      }).catch(() => {});
      setDownloadError(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-9 h-9 text-[#FFD700] animate-spin" /></div>;
  }

  if (error || !data?.project) {
    const paymentRequired = error?.response?.status === 402 || error?.response?.data?.error === 'payment_required';
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[#0a0a0a] border border-red-500/30 rounded-3xl p-8 text-center max-w-md text-white">
          <ShieldOff className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">{paymentRequired ? 'הגלריה ממתינה לתשלום' : 'הגלריה לא זמינה'}</h1>
          <p className="text-white/60 text-sm">{paymentRequired ? 'הצלם פתח את הגלריה רק ללקוחות ששילמו. לאחר סימון התשלום הקישור ייפתח אוטומטית.' : 'הקישור לא נמצא או שתוקפו פג.'}</p>
        </div>
      </div>
    );
  }

  const { project, files = [] } = data;
  const driveFolderUrl = `https://drive.google.com/drive/folders/${folderId}`;

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

        <div className="max-w-xl mx-auto rounded-[2rem] border border-[#FFD700]/25 bg-[#0a0a0a]/90 p-8 md:p-10 text-center shadow-[0_0_60px_rgba(255,215,0,0.12)]">
          <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center mx-auto mb-5 text-3xl">📁</div>
          <h2 className="text-2xl md:text-3xl font-black text-[#FFD700] mb-3">התיקייה מוכנה להורדה</h2>
          <p className="text-white/60 leading-7 mb-7">כל קבצי הפרויקט ירדו למכשיר כקובץ ZIP אחד, אחרי אישור קבלת הקבצים.</p>
          <button
            onClick={() => setConsentOpen(true)}
            disabled={busy || files.length === 0}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black shadow-[0_10px_30px_rgba(255,215,0,0.28)] hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'מכין ZIP...' : `הורד ZIP (${files.length} קבצים)`}
          </button>
          {downloaded && <p className="mt-4 text-emerald-400 font-bold">✓ ההורדה החלה והאישור נשמר</p>}
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">{files.length}</div><div className="text-xs text-white/45">קבצים זמינים</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">90</div><div className="text-xs text-white/45">ימי שמירה</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">Drive</div><div className="text-xs text-white/45">מקור הקבצים</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-[#FFD700]">LIVE</div><div className="text-xs text-white/45">סנכרון תיקייה</div></div>
        </div>
      </main>

      <StickyDownloadButton position="bottom" busy={busy} fileCount={files.length} onClick={() => setConsentOpen(true)} />
      <ConsentDownloadDialog open={consentOpen} busy={busy} progress={downloadProgress} error={downloadError} driveFolderUrl={driveFolderUrl} onClose={() => setConsentOpen(false)} onConfirm={handleConfirmDownload} />
    </div>
  );
}