import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check dismiss cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    // iOS detection (no beforeinstallprompt on iOS)
    const iosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iosDevice);

    if (iosDevice) {
      // On iOS, always show the manual instructions banner
      setShowBanner(true);
      return;
    }

    // Android/Chrome - listen for install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // Can't programmatically install on iOS, just show instructions
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[60] md:hidden animate-slide-up" dir="rtl">
      <div className="bg-black/95 backdrop-blur-xl border border-[#FFD700]/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(255,215,0,0.15)]">
        <button
          onClick={handleDismiss}
          className="absolute top-3 left-3 text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#b38f2d] flex items-center justify-center flex-shrink-0 shadow-lg">
            <Download className="w-6 h-6 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">התקן את KLIKLY</p>
            <p className="text-white/50 text-xs mt-0.5">
              {isIOS
                ? 'לחץ על כפתור השיתוף ואז "הוסף למסך הבית"'
                : 'הוסף למסך הבית לגישה מהירה'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-gradient-to-r from-[#FFD700] to-[#C5A028] text-black font-bold text-sm py-2.5 rounded-xl shadow-[0_4px_14px_rgba(255,215,0,0.25)] active:scale-95 transition-transform"
            >
              התקן עכשיו
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`${isIOS ? 'flex-1' : ''} px-4 py-2.5 bg-white/10 text-white/70 font-medium text-sm rounded-xl active:scale-95 transition-transform`}
          >
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}