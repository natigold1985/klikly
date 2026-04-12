import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, Camera } from 'lucide-react';
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

  const loadLink = async () => {
    try {
      // Delivery Controller (Backend Function) - Absolute Isolation
      const res = await base44.functions.invoke('getDeliveryLink', { token });
      setLinkData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'הקישור לא נמצא או פג תוקף');
    } finally {
      setLoading(false);
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
        
        <p className="text-white/40 tracking-[0.2em] uppercase text-xs font-medium">
          Secure Delivery Controller • Base 44
        </p>
      </motion.div>
    </div>
  );
}