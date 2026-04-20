import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { urlBase64ToUint8Array, getDeviceLabel, registerServiceWorker, isPushSupported } from '@/lib/pushUtils';

export default function PushNotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!isPushSupported()) {
      setLoading(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
    setLoading(false);
  };

  const subscribe = async () => {
    setToggling(true);
    try {
      const keyRes = await base44.functions.invoke('getVapidPublicKey', {});
      const vapidPublicKey = keyRes.data.publicKey;

      const registration = await registerServiceWorker();
      if (!registration) {
        toast.error('המכשיר לא תומך בהתראות');
        setToggling(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisuallyIndicatesInterest: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await base44.functions.invoke('subscribePush', {
        subscription: subscription.toJSON(),
        deviceLabel: getDeviceLabel()
      });

      setIsSubscribed(true);
      toast.success('התראות הופעלו בהצלחה! 🔔');
    } catch (err) {
      console.error('Push subscribe error:', err);
      if (Notification.permission === 'denied') {
        toast.error('התראות חסומות בדפדפן. אנא הפעל בהגדרות.');
      } else {
        toast.error('שגיאה בהפעלת התראות: ' + err.message);
      }
    }
    setToggling(false);
  };

  const unsubscribe = async () => {
    setToggling(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await base44.functions.invoke('unsubscribePush', {
            endpoint: subscription.endpoint
          });
          await subscription.unsubscribe();
        }
      }
      setIsSubscribed(false);
      toast.success('התראות כובו');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      toast.error('שגיאה בכיבוי התראות');
    }
    setToggling(false);
  };

  if (loading) return null;
  if (!isPushSupported()) return null;

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={toggling}
      className={`relative p-2.5 rounded-xl transition-all duration-200 active:scale-95 ${
        isSubscribed 
          ? 'bg-[#FFD700]/20 text-[#FFD700]' 
          : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/15'
      }`}
      title={isSubscribed ? 'כבה התראות' : 'הפעל התראות'}
    >
      {toggling ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-5 h-5" />
      ) : (
        <BellOff className="w-5 h-5" />
      )}
      {isSubscribed && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-[#FFD700] rounded-full" />
      )}
    </button>
  );
}