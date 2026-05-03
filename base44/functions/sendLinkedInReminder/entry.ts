// Twice-daily LinkedIn lead-hunting reminder.
// Sends a PUSH notification (NOT an email) to avoid credits.
// Push opens the LeadImport page where the user pastes LinkedIn results.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find the admin (the photographer running this app).
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const target = admins[0] || { email: 'natigold04@gmail.com', full_name: 'בעל העסק' };

    const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
    const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
    if (!vapidPublic || !vapidPrivate) {
      return Response.json({ error: 'VAPID not configured' }, { status: 500 });
    }

    webpush.setVapidDetails('mailto:' + target.email, vapidPublic, vapidPrivate);

    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: target.email,
      is_active: true,
    });

    const pushPayload = JSON.stringify({
      title: '🎯 תזכורת LinkedIn',
      body: 'הגיע הזמן לסריקת לידים. לחץ כאן לפתיחת ייבוא לידים.',
      icon: '/icon-192.png',
      url: '/LeadImport',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          pushPayload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
        }
      }
    }

    return Response.json({ success: true, sent_to: target.email, push_sent: sent });
  } catch (error) {
    console.error('sendLinkedInReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});