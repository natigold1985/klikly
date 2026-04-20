import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      setLoading(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
    setLoading(false);
  };

  const handleToggle = async () => {
    setLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await base44.functions.invoke('subscribePush', {
              subscription: { endpoint: subscription.endpoint },
              action: 'unsubscribe',
            });
            await subscription.unsubscribe();
          }
        }
        setIsSubscribed(false);
        toast.success('התראות בוטלו');
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('ההתראות נחסמו בדפדפן. יש לאפשר התראות בהגדרות הדפדפן');
          setLoading(false);
          return;
        }

        // Get VAPID public key from server
        const { data } = await base44.functions.invoke('getVapidPublicKey', {});
        const vapidPublicKey = data.vapidPublicKey;

        // Register service worker
        let registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        // Wait until SW is active
        await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const subJson = subscription.toJSON();

        await base44.functions.invoke('subscribePush', {
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            deviceLabel: navigator.userAgent.substring(0, 100),
          },
          action: 'subscribe',
        });

        setIsSubscribed(true);
        toast.success('התראות הופעלו בהצלחה!');
      }
    } catch (err) {
      console.error('Push toggle error:', err);
      toast.error('שגיאה בהפעלת התראות');
    }

    setLoading(false);
  };

  const handleTest = async () => {
    try {
      toast.loading('שולח התראת בדיקה...', { id: 'test-push' });
      const res = await base44.functions.invoke('sendPushNotification', {
        title: '🔔 KLIKLY',
        body: 'התראת בדיקה - המערכת עובדת!',
        url: '/',
      });
      if (res.data.sent > 0) {
        toast.success(`התראה נשלחה בהצלחה!`, { id: 'test-push' });
      } else {
        toast.error('לא נמצאו מכשירים רשומים', { id: 'test-push' });
      }
    } catch (err) {
      toast.error('שגיאה בשליחת התראה', { id: 'test-push' });
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-xl text-slate-500 text-sm">
        <BellOff className="w-5 h-5" />
        <span>הדפדפן שלך לא תומך בהתראות Push</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-green-600" />
          ) : (
            <BellOff className="w-5 h-5 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">
              {isSubscribed ? 'התראות פעילות' : 'התראות כבויות'}
            </p>
            <p className="text-xs text-slate-500">
              {isSubscribed ? 'תקבל התראות גם כשהאתר סגור' : 'הפעל כדי לקבל עדכונים בזמן אמת'}
            </p>
          </div>
        </div>

        <Button
          onClick={handleToggle}
          disabled={loading}
          variant={isSubscribed ? 'outline' : 'default'}
          size="sm"
          className={isSubscribed ? '' : 'bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold'}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSubscribed ? (
            'כבה'
          ) : (
            'הפעל'
          )}
        </Button>
      </div>

      {isSubscribed && (
        <Button
          onClick={handleTest}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          🔔 שלח התראת בדיקה
        </Button>
      )}
    </div>
  );
}