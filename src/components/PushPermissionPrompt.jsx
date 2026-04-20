import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { urlBase64ToUint8Array, getDeviceLabel, registerServiceWorker, isPushSupported } from '@/lib/pushUtils';

export default function PushPermissionPrompt() {
  useEffect(() => {
    autoSubscribe();
  }, []);

  const autoSubscribe = async () => {
    if (!isPushSupported()) return;
    if (Notification.permission === 'denied') return;

    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return;

      const registration = await registerServiceWorker();
      if (!registration) return;

      // Check if already subscribed
      const existing = await registration.pushManager.getSubscription();
      if (existing) return;

      // If permission not yet asked, request it
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      // Get VAPID key and subscribe
      const keyRes = await base44.functions.invoke('getVapidPublicKey', {});
      const vapidPublicKey = keyRes.data.publicKey;

      const subscription = await registration.pushManager.subscribe({
        userVisuallyIndicatesInterest: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await base44.functions.invoke('subscribePush', {
        subscription: subscription.toJSON(),
        deviceLabel: getDeviceLabel()
      });

      console.log('Auto push subscription successful');
    } catch (err) {
      console.error('Auto push subscribe error:', err);
    }
  };

  return null;
}