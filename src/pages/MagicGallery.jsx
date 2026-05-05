import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Download, Loader2, ShieldOff, ArrowRight, Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DriveFilesGrid from '../components/storage/DriveFilesGrid';
import ClientUploadDropzone from '../components/storage/ClientUploadDropzone';
import { toast } from 'sonner';

// Public Magic Link gallery — accessible without auth via /g/:token
// Pulls files directly from photographer's Google Drive (zero-cost).
export default function MagicGallery() {
  const { token } = useParams();
  const [downloading, setDownloading] = useState(false);

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

  // Mark "page viewed" once
  useEffect(() => {
    if (data?.project?.id) {
      base44.functions.invoke('trackDownload', { token, file_name: null, download_type: 'page_view' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project?.id]);

  const handleDownloadOne = (file) => {
    base44.functions.invoke('trackDownload', { token, file_name: file.name, download_type: 'single' }).catch(() => {});
    window.open(file.download_url, '_blank');
  };

  const handleDownloadAll = async (filesToDownload) => {
    const list = filesToDownload || data?.files || [];
    if (!list.length) return;
    setDownloading(true);
    // Trigger backend webhook — push notification + email + DB log
    base44.functions.invoke('trackDownload', {
      token,
      file_name: 'ALL',
      download_type: 'download_all',
      file_count: list.length,
    }).catch(() => {});
    // Open each file in a new tab — browser will trigger download
    list.forEach((f, i) => {
      setTimeout(() => window.open(f.download_url, '_blank'), i * 250);
    });
    setTimeout(() => {
      setDownloading(false);
      toast.success(`ההורדה החלה (${list.length} קבצים) — הצלם קיבל התראה`);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
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

  const { project, files } = data;

  return (
    <div className="min-h-screen bg-black text-white pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.close()}
              className="shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="חזרה"
              aria-label="חזרה"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-[#FFD700] tracking-wide truncate">{project.client_name}</h1>
              <p className="text-xs md:text-sm text-white/50 truncate">
                {project.shooting_type}
                {project.shooting_date && ` • ${new Date(project.shooting_date).toLocaleDateString('he-IL')}`}
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <Button
              onClick={() => handleDownloadAll(files)}
              disabled={downloading}
              className="gap-2 shrink-0"
              size="lg"
            >
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span className="hidden sm:inline">הורד הכל ({files.length})</span>
              <span className="sm:hidden">{files.length}</span>
            </Button>
          )}
        </div>
      </header>

      {/* Gallery */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {data.folder_missing ? (
          <div className="text-center py-32 opacity-70">
            <Camera className="w-16 h-16 mx-auto mb-4 text-white/40" />
            <h2 className="text-xl">הגלריה עוד בהכנה</h2>
            <p className="text-white/50 text-sm mt-2">הצלם עדיין לא העלה קבצים. נסה שוב מאוחר יותר.</p>
          </div>
        ) : (
          <div className="bg-white text-slate-900 rounded-2xl p-4 md:p-6">
            <DriveFilesGrid files={files} onDownload={handleDownloadOne} onDownloadAll={handleDownloadAll} />
          </div>
        )}

        {/* Client direct upload — files go straight to the photographer's Drive folder */}
        <section className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <UploadIcon className="w-5 h-5 text-[#FFD700]" />
            <h3 className="text-lg font-bold text-white">העלאת קבצים לצלם</h3>
          </div>
          <p className="text-sm text-white/60 mb-4 leading-relaxed">
            צריך לשלוח לצלם תמונות השראה או קבצי הפניה? העלה אותם כאן — הם יישלחו ישירות לתיקיית הפרויקט שלו ב-Drive.
          </p>
          <ClientUploadDropzone token={token} />
        </section>

        {/* Footer disclaimer per spec */}
        <p className="text-center text-white/40 text-[11px] mt-12 max-w-2xl mx-auto leading-relaxed">
          KLIKLY הינה ממשק תצוגה לאחסון ענן של צד שלישי. הבעלות והאבטחה של הנתונים מנוהלות על ידי חשבון ספק הענן של המשתמש.
        </p>
      </main>
    </div>
  );
}