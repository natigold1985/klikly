import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Star, BookOpen, Camera, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DownloadPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('קישור לא תקין');
      setLoading(false);
      return;
    }
    loadLink();
  }, [token]);

  const loadLink = async () => {
    try {
      const res = await base44.functions.invoke('getDeliveryLink', { token });
      setLinkData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'הקישור לא נמצא או פג תוקף');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await base44.functions.invoke('trackDeliveryLink', { token });
      const fileUrl = res.data.file_url;
      setDownloaded(true);
      // Open download in new tab
      window.open(fileUrl, '_blank');
    } catch (err) {
      setError('שגיאה בהורדה, אנא נסה שוב');
    } finally {
      setDownloading(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-2xl font-bold mb-2">אופס...</h2>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  const bgImage = linkData?.cover_image_url;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden" dir="rtl">
      
      {/* Background blur image */}
      {bgImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        </>
      )}
      {!bgImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#1a1a1a] to-black" />
      )}

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-between p-6 py-12">
        
        {/* Top: Project Info */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
            <Camera className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-white/80 text-sm">Klikly</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            היי {linkData?.client_name} 👋
          </h1>
          <p className="text-white/60 text-lg">
            הקבצים שלך מ<span className="text-[#D4AF37] font-medium">"{linkData?.project_title}"</span> מוכנים!
          </p>
        </div>

        {/* Center: Download Button */}
        <div className="text-center w-full max-w-sm">
          {downloaded ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">הורדה החלה! ✅</h2>
              <p className="text-white/60 mb-8">הקבצים יורדו לא תקינות שלך</p>
              <button
                onClick={handleDownload}
                className="text-[#D4AF37] underline text-sm"
              >
                לחץ כאן אם ההורדה לא התחילה
              </button>
            </div>
          ) : (
            <>
              {/* Main Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="
                  w-full py-6 px-8 rounded-2xl
                  bg-gradient-to-r from-[#D4AF37] to-[#C5A028]
                  hover:from-[#e8c245] hover:to-[#D4AF37]
                  active:scale-95
                  transition-all duration-200
                  shadow-2xl shadow-[#D4AF37]/40
                  disabled:opacity-70
                  group
                "
              >
                {downloading ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-7 h-7 text-black animate-spin" />
                    <span className="text-black text-xl font-bold">מכין הורדה...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Download className="w-7 h-7 text-black group-hover:scale-110 transition-transform" />
                    <div className="text-right">
                      <div className="text-black text-xl font-bold leading-tight">
                        הורדת כל הקבצים
                      </div>
                      {linkData?.file_size_label && (
                        <div className="text-black/70 text-sm font-medium">
                          {linkData.file_size_label}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </button>

              {/* Upsell */}
              <div className="mt-6 p-5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="flex items-start gap-3 text-right">
                  <BookOpen className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-base mb-1">
                      אהבתם את התוצאות? 📸
                    </p>
                    <p className="text-white/70 text-sm mb-3">
                      הזמינו אלבום פרימיום מודפס ב-<span className="text-[#D4AF37] font-bold">15% הנחה</span> — רק עבורכם, היום בלבד.
                    </p>
                    <button className="
                      w-full py-2.5 px-4 rounded-lg
                      bg-white/20 hover:bg-white/30
                      border border-white/30
                      text-white font-medium text-sm
                      transition-all duration-200
                    ">
                      <Star className="w-4 h-4 inline ml-2 text-[#D4AF37]" />
                      הזמן אלבום מודפס →
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: PLG */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2.5">
            <Camera className="w-4 h-4 text-[#D4AF37]" />
            <p className="text-white/50 text-xs">
              גם אתם צלמים?{' '}
              <a 
                href="/" 
                className="text-[#D4AF37] hover:text-[#e8c245] font-medium transition-colors"
              >
                תתחילו להעביר קבצים בסטייל
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}