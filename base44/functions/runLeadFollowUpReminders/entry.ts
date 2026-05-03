import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Sends a PUSH reminder to the photographer about leads created X days ago
// that haven't been closed yet. NO email = NO credits.
// Triggered by a scheduled automation (daily at 09:00 photographer time).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
    const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
    if (!vapidPublic || !vapidPrivate) {
      return Response.json({ error: 'VAPID not configured' }, { status: 500 });
    }

    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 500);
    const enabledSettings = allSettings.filter((s) => s.lead_followup_enabled !== false);

    let totalNotified = 0;
    const summary = [];

    for (const settings of enabledSettings) {
      const photographerEmail = settings.created_by;
      if (!photographerEmail) continue;

      const days = settings.lead_followup_days || 3;
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();

      const allLeads = await base44.asServiceRole.entities.Lead.filter(
        { created_by: photographerEmail },
        '-created_date',
        500
      );

      const staleLeads = allLeads.filter((l) => {
        if (['closed_won', 'closed_lost'].includes(l.status)) return false;
        if (!l.created_date) return false;
        return l.created_date <= cutoffIso;
      });

      if (staleLeads.length === 0) continue;

      // Send PUSH instead of Email
      webpush.setVapidDetails('mailto:' + photographerEmail, vapidPublic, vapidPrivate);
      const subs = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: photographerEmail,
        is_active: true,
      });

      const pushPayload = JSON.stringify({
        title: `🔔 ${staleLeads.length} לידים מחכים לטיפול`,
        body: `${staleLeads.length} לידים פתוחים מעל ${days} ימים — שווה לחזור אליהם.`,
        icon: '/icon-192.png',
        url: '/Leads',
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

      if (sent > 0) {
        totalNotified++;
        summary.push({ photographer: photographerEmail, leads: staleLeads.length, push_sent: sent });
      }
    }

    return Response.json({ ok: true, photographers_notified: totalNotified, summary });
  } catch (error) {
    console.error('runLeadFollowUpReminders error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});