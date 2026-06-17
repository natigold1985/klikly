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
    setDownloadProgress('מתחיל הורדה ישירה של כל הקבצים...');

    try {
      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_confirmed',
        file_count: filesToDownload.length,
      });
      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_started',
        file_count: filesToDownload.length,
      });

      let downloadedCount = 0;
      for (let index = 0; index < filesToDownload.length; index += 1) {
        const file = filesToDownload[index];
        setDownloadProgress(`מוריד קובץ ${index + 1} מתוך ${filesToDownload.length}: ${file.name}`);
        const fileResponse = await base44.functions.fetch('/downloadFolderFile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_id: folderId, file_id: file.id }),
        });
        if (!fileResponse.ok) throw new Error(`שגיאה בהורדת ${file.name || 'קובץ'}`);
        const blob = await fileResponse.blob();
        const responseFileName = decodeURIComponent(fileResponse.headers.get('X-File-Name') || '') || file.name || `studio-gold-${index + 1}`;
        const fileUrl = URL.createObjectURL(blob);
        triggerDownload(fileUrl, responseFileName);
        downloadedCount += 1;
        setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      await base44.functions.invoke('trackFolderDelivery', {
        folder_id: folderId,
        action_type: 'download_completed',
        file_count: downloadedCount || filesToDownload.length,
      });
      setDownloaded(true);
      setDownloadProgress('כל ההורדות נפתחו. אם הדפדפן מבקש אישור להורדת מספר קבצים — יש לאשר. אישור נשלח אליך וללקוח.');
      setConsentOpen(false);
    } catch (error) {
      setDownloadError(error?.response?.data?.error || error?.message || 'שגיאה בהכנת ההורדה');
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
          <p className="text-white/60 leading-7 mb-7">כל קבצי הפרויקט ירדו ישירות למכשיר, קובץ אחרי קובץ. אם הדפדפן מבקש אישור להורדת מספר קבצים — יש לאשר.</p>
          <button
            onClick={() => setConsentOpen(true)}
            disabled={busy || files.length === 0}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black shadow-[0_10px_30px_rgba(255,215,0,0.28)] hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'מוריד קבצים...' : `הורד את כל הקבצים (${files.length})`}
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