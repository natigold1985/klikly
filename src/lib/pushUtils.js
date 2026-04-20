// Service Worker code as a string - will be registered as a Blob
const SW_CODE = `
self.addEventListener('push', function(event) {
  let data = { title: 'KLIKLY', body: '', url: '/' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {}
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'KLIKLY', {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: data.icon || '/favicon.ico',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`;

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop';
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  
  // Try the public sw.js first
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('sw.js register failed, trying blob approach:', e.message);
  }
  
  // Fallback: register as blob
  const blob = new Blob([SW_CODE], { type: 'application/javascript' });
  const swUrl = URL.createObjectURL(blob);
  try {
    const reg = await navigator.serviceWorker.register(swUrl);
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e2) {
    console.error('Blob SW register also failed:', e2.message);
    return null;
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}