// Sends a PUSH notification to the user when an automation/operation consumed credits.
// Call this from any function that uses billable integrations:
//   - InvokeLLM, GenerateImage, GenerateVideo, ExtractDataFromUploadedFile, SendEmail
//
// Usage from another backend function:
//   await base44.asServiceRole.functions.invoke('notifyCreditUsage', {
//     user_email: 'foo@bar.com',
//     operation: 'AI Lead Extraction',
//     details: '12 contacts extracted from LinkedIn paste',
//   });

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email, operation, details } = await req.json();

    if (!user_email || !operation) {
      return Response.json({ error: 'user_email and operation required' }, { status: 400 });
    }

    const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
    const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
    if (!vapidPublic || !vapidPrivate) {
      return Response.json({ error: 'VAPID not configured' }, { status: 500 });
    }

    webpush.setVapidDetails('mailto:' + user_email, vapidPublic, vapidPrivate);

    const subs = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email,
      is_active: true,
    });

    if (subs.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'No active subscriptions' });
    }

    const pushPayload = JSON.stringify({
      title: '💳 שימוש בקרדיטים',
      body: `${operation}${details ? ' — ' + details : ''}`,
      icon: '/icon-192.png',
      url: '/Settings',
    });

    let sent = 0;
    for (const sub of subs) {
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

    // Log for audit
    await base44.asServiceRole.entities.SystemLog.create({
      action: 'Credit Usage Notification',
      details: `${operation}${details ? ' — ' + details : ''}`,
      status: 'success',
      owner_id: user_email,
    });

    return Response.json({ ok: true, sent });
  } catch (error) {
    console.error('notifyCreditUsage error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});