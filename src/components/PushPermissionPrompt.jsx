import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop';
}

export default function PushPermissionPrompt() {
  useEffect(() => {
    autoSubscribe();
  }, []);

  const autoSubscribe = async () => {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    // If already denied or already granted+subscribed, skip
    if (Notification.permission === 'denied') return;

    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return;

      // Register SW
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existing = await registration.pushManager.getSubscription();
      if (existing) return; // Already subscribed, nothing to do

      // If permission not yet asked, request it
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      // Subscribe
      const keyRes = await base44.functions.invoke('getVapidPublicKey', {});
      const vapidPublicKey = keyRes.data.publicKey;

      const subscription = await registration.pushManager.subscribe({
        userVisuallyIndicatesInterest: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Save to backend
      await base44.functions.invoke('subscribePush', {
        subscription: subscription.toJSON(),
        deviceLabel: getDeviceLabel()
      });
    } catch (err) {
      console.error('Auto push subscribe error:', err);
    }
  };

  return null; // No UI - runs silently
}