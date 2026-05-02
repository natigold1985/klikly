// Called by the client app when the client downloads their first file.
// - Starts the 90-day retention clock (sets first_download_at + client_files_expire_at)
// - Sends push notification to the photographer
// - Always sends an email to the client confirming the download (per user request)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_name } = await req.json().catch(() => ({}));

    // The caller must be a client
    if (me.role !== 'client') {
      return Response.json({ error: 'Only clients can trigger this' }, { status: 403 });
    }

    const photographerEmail = me.assigned_photographer_email;
    let isFirstDownload = !me.first_download_at;

    // Start the 90-day retention clock on first download
    if (isFirstDownload) {
      const now = new Date();
      const expireAt = new Date(now);
      expireAt.setDate(expireAt.getDate() + 90);

      await base44.asServiceRole.entities.User.update(me.id, {
        first_download_at: now.toISOString(),
        client_files_expire_at: expireAt.toISOString(),
        reminder_milestones_sent: [],
      });
    }

    // Always send the photographer a push notification (per request: every download)
    if (photographerEmail) {
      try {
        const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
        const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
        if (vapidPublic && vapidPrivate) {
          webpush.setVapidDetails('mailto:noreply@base44.app', vapidPublic, vapidPrivate);
          const subs = await base44.asServiceRole.entities.PushSubscription.filter({
            user_email: photographerEmail,
            is_active: true,
          });
          const payload = JSON.stringify({
            title: '⬇️ הלקוח הוריד קבצים',
            body: `${me.full_name || me.email} הוריד${file_name ? ` "${file_name}"` : ' קובץ'}${isFirstDownload ? ' (הורדה ראשונה)' : ''}`,
            icon: '/icon-192.png',
            url: '/FileStorage',
          });
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
                payload
              );
            } catch (e) {
              if (e.statusCode === 410 || e.statusCode === 404) {
                await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
              }
            }
          }
        }
      } catch (e) {
        console.error('photographer push failed:', e.message);
      }
    }

    // Always confirm to client via email (per user request: client gets email every download)
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: me.email,
        subject: '✅ אישור הורדת קובץ',
        body: `שלום ${me.full_name || ''},\n\nהורדת ${file_name ? `את הקובץ "${file_name}"` : 'קובץ'} בהצלחה.\n\n${
          isFirstDownload
            ? 'שים לב: הקבצים יישמרו במערכת למשך 90 ימים מהיום (תאריך ההורדה הראשונה). לאחר מכן הם יימחקו אוטומטית.'
            : ''
        }\n\nתודה!`,
      });
    } catch (e) {
      console.error('client confirmation email failed:', e.message);
    }

    return Response.json({ success: true, first_download: isFirstDownload });
  } catch (error) {
    console.error('onClientFirstDownload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});