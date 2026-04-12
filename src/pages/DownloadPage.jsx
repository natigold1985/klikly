import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, Camera, Download, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DownloadPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('קישור לא תקין');
      setLoading(false);
      return;
    }
    loadLink();
  }, [token]);

  const [downloading, setDownloading] = useState(false);

  const loadLink = async () => {
    try {
      // Delivery Gateway (Backend Function) - Absolute Isolation
      const res = await base44.functions.invoke('deliveryGateway', { token });
      setLinkData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'הקישור לא נמצא או פג תוקף');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileName) => {
    try {
      setDownloading(true);
      
      // 1. Fetch Presigned URL
      const urlRes = await base44.functions.invoke('generatePresignedUrl', {
        token,
        action: 'get',
        fileName
      });
      
      const presignedUrl = urlRes.data.url;

      // 2. Fire Download Webhook
      await base44.functions.invoke('onClientDownload', {
        token,
        fileName
      });

      // 3. Initiate Secure Download
      window.location.href = presignedUrl;

    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFD700]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-white">שגיאת גישה</h2>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center relative overflow-hidden" dir="rtl">
      {/* Abstract Luxury Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.05)_0%,rgba(0,0,0,0)_70%)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center px-4"
      >
        <div className="w-16 h-16 mx-auto mb-8 rounded-full border border-[#FFD700]/30 bg-black flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.15)]">
          <Camera className="w-6 h-6 text-[#FFD700]" />
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#FFD700] mb-4 drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
          {linkData?.project_title}
        </h1>
        
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#FFD700]/50 to-transparent mx-auto my-6" />
        
        {linkData?.files?.map((file, idx) => (
          <button
            key={idx}
            onClick={() => handleDownload(file.name)}
            disabled={downloading}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-70"
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5 transition-transform group-hover:-translate-y-1" />
            )}
            <span>{downloading ? 'מכין קבצים להורדה...' : 'הורד גלריה מלאה'}</span>
            {file.size && <span className="opacity-70 text-sm">({file.size})</span>}
          </button>
        ))}

        <div className="mt-12 flex items-center justify-center gap-2 text-white/40 tracking-[0.2em] uppercase text-[10px] font-medium">
          <ShieldCheck className="w-4 h-4 text-green-500/70" />
          <span>Secure Delivery Gateway • 256-bit Encrypted</span>
        </div>
      </motion.div>
    </div>
  );
}