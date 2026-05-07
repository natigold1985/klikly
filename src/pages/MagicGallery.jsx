import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DriveFilesGrid from '@/components/storage/DriveFilesGrid';
import { Download, Loader2, ShieldOff, CheckCircle2, LockKeyhole } from 'lucide-react';

// Public Magic Link gallery — minimalist MVP per spec.
// Shows: client name + project title + ONE massive "Download All Files" button.
// On click: opens Drive folder in new tab + fires backend webhook (DB log + push + email).
export default function MagicGallery() {
  const { token } = useParams();
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['magicGallery', token],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFiles', { token, pin });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed to load');
      return res.data;
    },
    enabled: !!token && pinUnlocked,
    retry: false,
  });

  const unlockWithPin = async () => {
    setPinError('');
    const res = await base44.functions.invoke('listDriveFiles', { token, pin });
    if (res.data?.project) {
      setPinUnlocked(true);
      return;
    }
    setPinError('קוד הגישה שגוי');
  };

  const handleDownloadFile = (file) => {
    if (!file?.download_url) return;
    window.open(file.download_url, '_blank', 'noopener,noreferrer');
    base44.functions.invoke('trackDownload', {
      token,
      file_name: file.name,
      download_type: 'single_file',
      file_count: 1,
    }).catch(() => {});
  };

  const handleDownloadVisible = async (visibleFiles) => {
    visibleFiles.slice(0, 25).forEach((file, index) => {
      setTimeout(() => window.open(file.download_url, '_blank', 'noopener,noreferrer'), index * 120);
    });
    base44.functions.invoke('trackDownload', {
      token,
      file_name: 'VISIBLE_FILES',
      download_type: 'bulk_visible',
      file_count: visibleFiles.length,
    }).catch(() => {});
  };

  const handleDownloadAll = async () => {
    if (!data?.project?.drive_folder_url) return;
    setBusy(true);

    // Action A: Open Drive folder in new tab
    window.open(data.project.drive_folder_url, '_blank', 'noopener,noreferrer');

    // Action B: Fire tracking webhook (logs DB + push + email to photographer)
    base44.functions
      .invoke('trackDownload', {
        token,
        file_name: 'ALL',
        download_type: 'download_all',
        file_count: data?.files?.length || 0,
      })
      .catch(() => {});

    setTimeout(() => {
      setBusy(false);
      setDownloaded(true);
    }, 800);
  };

  React.useEffect(() => {
    base44.auth.isAuthenticated().then(async (isAuthed) => {
      if (!isAuthed) return;
      const me = await base44.auth.me();
      if (me?.role === 'admin' || me?.email === 'natigold04@gmail.com') {
        setPinUnlocked(true);
      }
    }).catch(() => {});
  }, []);

  if (!pinUnlocked) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6" dir="rtl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.08)_0%,rgba(0,0,0,0)_70%)]" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockWithPin().catch(() => setPinError('קוד הגישה שגוי'));
          }}
          className="relative z-10 w-full max-w-sm bg-[#0a0a0a] border border-[#FFD700]/20 rounded-3xl p-8 text-center shadow-[0_0_40px_rgba(255,215,0,0.12)]"
        >
          <img
            src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png"
            alt="KLIKLY"
            className="h-12 mx-auto mb-8 object-contain"
          />
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-[#FFD700]/30 bg-black flex items-center justify-center">
            <LockKeyhole className="w-7 h-7 text-[#FFD700]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#FFD700] mb-2">כניסה לגלריה</h1>
          <p className="text-white/60 text-sm mb-6">הקלד/י PIN כדי לצפות ולהוריד את הקבצים.</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            inputMode="numeric"
            placeholder="PIN"
            className="w-full h-14 rounded-2xl bg-white text-black text-center text-2xl font-bold tracking-[0.35em] outline-none border-2 border-transparent focus:border-[#FFD700] mb-3"
          />
          {pinError && <p className="text-red-400 text-sm mb-3">{pinError}</p>}
          <button
            type="submit"
            disabled={!pin}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-extrabold disabled:opacity-50"
          >
            פתח גלריה
          </button>
        </form>
      </div>
    );
  }

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
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6" dir="rtl">
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
            <button
              onClick={handleDownloadAll}
              disabled={busy}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFD700] via-[#FFC700] to-[#D4AF37] hover:shadow-[0_0_50px_rgba(255,215,0,0.6)] active:scale-[0.98] transition-all duration-300 px-8 py-5 mb-8 flex items-center justify-center gap-4 disabled:opacity-70"
            >
              {busy ? <Loader2 className="w-6 h-6 text-black animate-spin" /> : downloaded ? <CheckCircle2 className="w-6 h-6 text-black" /> : <Download className="w-6 h-6 text-black" />}
              <span className="text-lg md:text-xl font-bold text-black tracking-wide">
                {downloaded ? 'נפתח ב-Google Drive' : 'פתח תיקייה מלאה ב-Google Drive'}
              </span>
            </button>
            <div className="bg-white rounded-3xl p-4 md:p-6 text-slate-900 text-right shadow-2xl">
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
            ✓ הצלם קיבל התראה. הקבצים נפתחו ב-Google Drive.
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