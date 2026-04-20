import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
const VAPID_PRIVATE_KEY = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetEmail, title, body, url, icon } = await req.json();

    // If no targetEmail, send to current user
    const email = targetEmail || user.email;

    webpush.setVapidDetails(
      'mailto:' + user.email,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Get active subscriptions for target user
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: email,
      is_active: true
    });

    if (subscriptions.length === 0) {
      return Response.json({ error: 'No active subscriptions found for this user', sent: 0 });
    }

    const payload = JSON.stringify({
      title: title || 'KLIKLY',
      body: body || '',
      url: url || '/',
      icon: icon || '/favicon.ico'
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err) {
        failed++;
        // If subscription expired, mark as inactive
        if (err.statusCode === 410 || err.statusCode === 404) {
          await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
        }
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});