import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { target_email, title, body, url } = await req.json();

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublic || !vapidPrivate) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:' + user.email,
      vapidPublic,
      vapidPrivate
    );

    // Get subscriptions for target user (or current user if no target)
    const emailToNotify = target_email || user.email;
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: emailToNotify,
      is_active: true,
    });

    if (subscriptions.length === 0) {
      return Response.json({ error: 'No active subscriptions found', sent: 0 }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: title || 'KLIKLY',
      body: body || 'התראה חדשה',
      icon: '/icon-192.png',
      url: url || '/',
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err) {
        console.error('Push failed for', sub.endpoint, err.statusCode);
        failed++;
        // If subscription expired, deactivate it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
        }
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});