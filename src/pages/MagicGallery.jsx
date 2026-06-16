import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DriveFilesGrid from '@/components/storage/DriveFilesGrid';
import ThumbnailCarousel from '@/components/ui/thumbnail-carousel';
import { Loader2, ShieldOff } from 'lucide-react';

// Public Magic Link gallery — minimalist MVP per spec.
// Shows: client name + project title + ONE massive "Download All Files" button.
// On click: opens Drive folder in new tab + fires backend webhook (DB log + push + email).
export default function MagicGallery() {
  const { token } = useParams();
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const openTrackedRef = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['magicGallery', token],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFiles', { token });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed to load');
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });

  const saveBase64File = (base64, fileName, mimeType = 'application/octet-stream') => {
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
  };

  const downloadFileFromServer = async (file) => {
    const res = await base44.functions.invoke('downloadDriveFile', { token, file_id: file.id });
    saveBase64File(res.data.base64, res.data.name || file.name || 'download', res.data.mime_type);
  };

  const handleDownloadFile = async (file) => {
    if (!file?.id) return;
    await downloadFileFromServer(file);
    base44.functions.invoke('trackDownload', {
      token,
      file_name: file.name,
      download_type: 'single_file',
      event_type: 'download_completed',
      file_count: 1,
    }).catch(() => {});
  };

  const handleDownloadVisible = async (visibleFiles) => {
    setBusy(true);
    const filesToDownload = visibleFiles.slice(0, 25);
    for (const file of filesToDownload) {
      await downloadFileFromServer(file);
    }
    setBusy(false);
    setDownloaded(true);
    base44.functions.invoke('trackDownload', {
      token,
      file_name: 'VISIBLE_FILES',
      download_type: 'bulk_visible',
      event_type: 'download_completed',
      file_count: filesToDownload.length,
    }).catch(() => {});
  };

  const handleReminderConsent = async () => {
    await base44.functions.invoke('setGalleryReminderConsent', {
      token,
      wants_reminders: true,
    });
  };

  const handleDownloadAll = async () => {
    const filesToDownload = data?.files || [];
    if (!filesToDownload.length) return;
    setBusy(true);

    const zip = await base44.functions.invoke('downloadGalleryZip', { token });
    saveBase64File(zip.data.base64, zip.data.name || 'studio-gold-gallery.zip', 'application/zip');

    await base44.functions
      .invoke('trackDownload', {
        token,
        file_name: 'ALL_ZIP',
        download_type: 'download_all',
        event_type: 'download_completed',
        file_count: zip.data.file_count || filesToDownload.length,
      })
      .catch(() => {});

    setBusy(false);
    setDownloaded(true);
  };

  React.useEffect(() => {
    if (!data?.project || openTrackedRef.current) return;
    openTrackedRef.current = true;
    base44.functions.invoke('trackDownload', {
      token,
      event_type: 'gallery_open',
      download_type: 'gallery_open',
      file_name: 'GALLERY_OPEN',
      file_count: data?.files?.length || 0,
    }).catch(() => {});
  }, [data?.project, data?.files?.length, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
      </div>
    );
  }

  if (error || !data?.project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <ShieldOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">קישור לא תקף</h1>
          <p className="text-white/60 text-sm">הגלריה לא נמצאה או שפג תוקף הקישור.</p>
        </div>
      </div>
    );
  }

  const { project } = data;
  const hasDrive = !!project.drive_folder_url;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-3 py-5 md:p-6 font-sans" dir="rtl">
      <div className="w-full max-w-6xl text-center py-8">
        {/* Logo */}
        <img
          src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png"
          alt="KLIKLY"
          className="h-12 md:h-14 mx-auto mb-12 object-contain drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]"
        />

        {/* Client name + project title */}
        <p className="text-sm uppercase tracking-[0.3em] text-white/40 mb-3">
          הגלריה מוכנה
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-[#FFD700] mb-3 tracking-wide">
          {project.client_name}
        </h1>
        {project.shooting_type && (
          <p className="text-lg md:text-xl text-white/70 mb-12">
            {project.shooting_type}
            {project.shooting_date && (
              <>
                {' • '}
                {new Date(project.shooting_date).toLocaleDateString('he-IL')}
              </>
            )}
          </p>
        )}

        {hasDrive ? (
          <>
            <ThumbnailCarousel
              files={data.files || []}
              busy={busy}
              downloaded={downloaded}
              onDownload={handleDownloadAll}
            />
            <div className="mt-8 bg-white rounded-3xl p-3 md:p-6 text-slate-900 text-right shadow-2xl">
              <DriveFilesGrid files={data.files || []} project={project} onDownload={handleDownloadFile} onDownloadAll={handleDownloadVisible} />
            </div>
          </>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-8 text-white/60 text-sm">
            הגלריה עוד בהכנה. נסה שוב מאוחר יותר.
          </div>
        )}

        {downloaded && (
          <p className="text-sm text-emerald-400 mt-6 animate-pulse">
✓ הקבצים ירדו בהצלחה וההתראות נשלחו.
          </p>
        )}

        {/* Footer */}
        <p className="text-center text-white/30 text-[11px] mt-16 leading-relaxed">
          KLIKLY · ממשק תצוגה לאחסון ענן · הבעלות והאבטחה מנוהלות על ידי הצלם
        </p>
      </div>
    </div>
  );
}