import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Download, Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DriveFilesGrid from '../components/storage/DriveFilesGrid';
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

  const handleDownloadAll = async () => {
    if (!data?.files?.length) return;
    setDownloading(true);
    base44.functions.invoke('trackDownload', { token, file_name: 'ALL', download_type: 'download_all' }).catch(() => {});
    // Open each file in a new tab — browser will trigger download
    data.files.forEach((f, i) => {
      setTimeout(() => window.open(f.download_url, '_blank'), i * 250);
    });
    setTimeout(() => {
      setDownloading(false);
      toast.success('ההורדה החלה — בדוק את חלון הדפדפן');
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-[#FFD700] tracking-wide truncate">{project.client_name}</h1>
            <p className="text-xs md:text-sm text-white/50 truncate">
              {project.shooting_type}
              {project.shooting_date && ` • ${new Date(project.shooting_date).toLocaleDateString('he-IL')}`}
            </p>
          </div>
          {files.length > 0 && (
            <Button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="gap-2 shrink-0"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">הורד הכל</span>
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
            <DriveFilesGrid files={files} onDownload={handleDownloadOne} />
          </div>
        )}

        {/* Footer disclaimer per spec */}
        <p className="text-center text-white/40 text-[11px] mt-12 max-w-2xl mx-auto leading-relaxed">
          KLIKLY הינה ממשק תצוגה לאחסון ענן של צד שלישי. הבעלות והאבטחה של הנתונים מנוהלות על ידי חשבון ספק הענן של המשתמש.
        </p>
      </main>
    </div>
  );
}