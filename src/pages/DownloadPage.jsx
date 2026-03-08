import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Star, Upload, Image as ImageIcon, CheckCircle2, Loader2, AlertCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function DownloadPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      if (res.data.is_downloaded) {
        setDownloaded(true);
      }
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
      window.open(fileUrl, '_blank');
      toast.success('ההורדה החלה!');
    } catch (err) {
      toast.error('שגיאה בהורדה, אנא נסה שוב');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Upload file to storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // 2. Link file to project via token
      await base44.functions.invoke('uploadWithToken', {
        token,
        file_url,
        file_name: file.name,
        file_size: file.size
      });

      toast.success('הקובץ הועלה בהצלחה!');
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white" dir="rtl">
        <div className="h-[50vh] relative">
           <Skeleton className="w-full h-full bg-white/5" />
        </div>
        <div className="max-w-md mx-auto px-6 -mt-8 relative z-20 space-y-12 pb-20">
           <Skeleton className="h-48 w-full rounded-2xl bg-white/10" />
           <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
           <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">שגיאה</h2>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#D4AF37] selection:text-black" dir="rtl">
      
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px]">
        {/* Background Image */}
        <div className="absolute inset-0">
          {linkData?.cover_image_url ? (
            <img 
              src={linkData.cover_image_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-[#0a0a0a]" />
        </div>

        {/* Hero Content */}
        <div className="relative h-full flex flex-col items-center justify-end pb-12 px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium tracking-wide uppercase">הגלריה מוכנה</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">
            {linkData?.client_name}
          </h1>
          <p className="text-base md:text-lg text-white/70 max-w-md mx-auto">
            הזיכרונות שלכם מהפרויקט <br className="md:hidden" /><span className="text-[#D4AF37]">"{linkData?.project_title}"</span>
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-8 relative z-20 space-y-12 pb-20">
        
        {/* Main Action Card */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 shadow-2xl shadow-black/50">
          <div className="text-center space-y-6">
            
            {/* Download Button - Fixed on Mobile, Regular on Desktop */}
            <div className="fixed bottom-0 left-0 right-0 p-6 pb-10 bg-[#0a0a0a] z-50 md:relative md:bg-none md:p-0 md:z-0 border-t border-white/10 md:border-none shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
               <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B38F24] shadow-2xl shadow-[#D4AF37]/20 active:scale-[0.98] transition-transform duration-200"
              >
                <div className="relative bg-[#0a0a0a] group-hover:bg-opacity-0 transition-all duration-300 rounded-[15px] p-[1px]">
                  <div className="bg-[#111] hover:bg-[#1a1a1a] rounded-[14px] px-6 py-4 flex items-center justify-center gap-4 h-[60px]">
                  {downloading ? (
                    <Loader2 className="w-6 h-6 text-[#D4AF37] group-hover:text-black animate-spin" />
                  ) : downloaded ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 group-hover:text-black" />
                  ) : (
                    <Download className="w-6 h-6 text-[#D4AF37] group-hover:text-black" />
                  )}
                  <div className="text-right">
                    <div className={`font-bold text-lg ${downloaded ? 'text-green-500' : 'text-[#D4AF37]'} group-hover:text-black transition-colors`}>
                      {downloaded ? 'הורדה הושלמה' : 'הורדת כל הרגעים'}
                    </div>
                    {linkData?.file_size_label && !downloaded && (
                      <div className="text-xs text-white/50 group-hover:text-black/60 font-medium">
                        {linkData.file_size_label} • איכות מקורית
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
            </div>
            {/* Spacer for fixed button on mobile */}
            <div className="h-24 md:hidden"></div>

            {/* Thumbnails Preview */}
            {linkData?.preview_photos?.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {linkData.preview_photos.slice(0, 4).map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-white/5">
                    <img src={url} alt="" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Client Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Upload className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-lg font-semibold">העלאת רפרנסים</h3>
          </div>
          <p className="text-sm text-white/50 mb-4">
            יש לכם תמונות השראה או קבצים שתרצו לשתף איתי? ניתן להעלות אותם כאן ישירות לפרויקט.
          </p>
          
          <label className="block w-full cursor-pointer group">
            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all">
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
                  <span className="text-sm text-white/60">מעלה קובץ...</span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 text-white/60 group-hover:text-[#D4AF37]" />
                  </div>
                  <span className="text-sm font-medium text-white/80 group-hover:text-white">לחצו לבחירת קבצים</span>
                </>
              )}
            </div>
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Upsell Section */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#D4AF37]/10 blur-3xl rounded-full" />
          
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">אלבום פרימיום</h3>
                <p className="text-xs text-[#D4AF37] font-medium tracking-wide uppercase">הצעה מיוחדת</p>
              </div>
              <Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37]" />
            </div>
            
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              הפכו את הרגעים הדיגיטליים לאלבום פיזי יוקרתי בכריכה קשה. עיצוב אישי ומקצועי שישאר איתכם לתמיד.
            </p>

            <button className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors flex items-center justify-center gap-2 group-hover:border-[#D4AF37]/30">
              לפרטים והזמנה
              <Share2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Footer Branding (PLG) */}
        <div className="text-center pt-8 border-t border-white/5">
          <p className="text-xs text-white/30 mb-2">Powered by</p>
          <div className="inline-flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
            <span className="text-lg font-bold tracking-wider text-white">BASE 44</span>
          </div>
        </div>

      </div>
    </div>
  );
}