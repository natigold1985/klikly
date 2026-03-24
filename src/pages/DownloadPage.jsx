import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Upload, CheckCircle2, Loader2, AlertCircle, Share2, X, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function DownloadPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
      // Step 1: Get presigned URL
      const response = await base44.functions.invoke('generatePresignedUrl', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        token: token
      });
      
      const { uploadUrl, fileKey } = response.data;

      // Step 2: Upload directly to S3 (Bunny.net)
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed');
      }

      const file_url = `https://de.s3.bunnycdn.com/natiklikly/${fileKey}`;

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
      e.target.value = '';
    }
  };

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">שגיאה</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" dir="rtl">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-6 h-6 text-slate-800" />
          <span className="font-bold text-lg tracking-tight uppercase hidden md:inline">Photography</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleDownload}
            disabled={downloading}
            className="bg-black hover:bg-slate-800 text-white rounded-full px-4 md:px-6 py-5 shadow-lg shadow-black/10 transition-all font-medium text-sm gap-2"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : downloaded ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Download className="w-4 h-4" />}
            {downloaded ? 'ההורדה הושלמה' : 'שמירת כל הזיכרונות'}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-32 pb-16 px-6 max-w-6xl mx-auto text-center">
        {linkData?.cover_image_url && (
          <div className="max-w-4xl mx-auto h-[300px] md:h-[400px] rounded-3xl overflow-hidden mb-12 shadow-2xl">
            <img src={linkData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-4">
          הרגעים שלכם, עכשיו אצלכם.
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10">
          הגלריה המלאה מהפרויקט "{linkData?.project_title}" מוכנה. תוכלו להוריד הכל בקליק אחד, ללא הגבלת זמן או מקום.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={handleDownload}
            disabled={downloading}
            size="lg"
            className="w-full sm:w-auto bg-black hover:bg-slate-800 text-white rounded-xl px-8 h-14 text-base font-medium shadow-xl shadow-black/10 gap-2"
          >
             {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : downloaded ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Download className="w-5 h-5" />}
             {downloaded ? 'הורדה הושלמה' : 'שמירת כל הזיכרונות'}
             {linkData?.file_size_label && !downloaded && <span className="text-white/60 text-sm mr-1">({linkData.file_size_label})</span>}
          </Button>

          <Button 
            variant="outline"
            size="lg"
            className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl px-8 h-14 text-base font-medium gap-2 group"
          >
            <Share2 className="w-5 h-5 group-hover:text-[#D4AF37] transition-colors" />
            הזמנת אלבום מודפס
          </Button>
        </div>
      </div>

      {/* Masonry Grid */}
      {linkData?.preview_photos?.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-20">
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {linkData.preview_photos.map((url, i) => (
              <div 
                key={i} 
                className="break-inside-avoid relative group rounded-xl overflow-hidden cursor-pointer"
                onClick={() => openLightbox(i)}
              >
                <img src={url} alt={`Preview ${i}`} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 py-16 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="text-center md:text-right">
            <h3 className="font-bold text-lg mb-1">יש לכם שאלות?</h3>
            <p className="text-slate-500 text-sm">הפרויקט לא נגמר פה. צרו איתי קשר בכל עת.</p>
          </div>

          {/* Client Upload Section */}
          <div className="w-full md:w-auto">
            <label className="cursor-pointer">
              <div className="flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl px-6 py-4 transition-all active:scale-95">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-600" />
                )}
                <span className="font-medium text-slate-700">
                  {uploading ? 'מעלה...' : 'העלאת קבצים חזרה (רפרנס/ריטוש)'}
                </span>
              </div>
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

        </div>
      </footer>

      {/* Lightbox */}
      {lightboxOpen && linkData?.preview_photos && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-sm">
          <div className="flex justify-end p-6">
            <button 
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
             <img 
               src={linkData.preview_photos[currentImageIndex]} 
               className="max-w-full max-h-full object-contain rounded-md" 
               alt="Fullscreen Preview"
             />
          </div>
          {/* Thumbnails in Lightbox */}
          <div className="h-24 px-6 pb-6 flex items-center justify-center gap-2 overflow-x-auto">
             {linkData.preview_photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={`flex-shrink-0 h-16 w-16 rounded-md overflow-hidden transition-all ${currentImageIndex === i ? 'ring-2 ring-white scale-110 opacity-100' : 'opacity-50 hover:opacity-100'}`}
                >
                  <img src={url} className="w-full h-full object-cover" />
                </button>
             ))}
          </div>
        </div>
      )}

    </div>
  );
}