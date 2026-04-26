import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_email, file_count } = await req.json();
    if (!client_email) return Response.json({ error: 'Missing client_email' }, { status: 400 });

    const photographer = me;

    // Send Email
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client_email,
        from_name: photographer.full_name || 'הצלם שלך',
        subject: '📸 קיבלת קבצים חדשים!',
        body: `שלום,\n\n${photographer.full_name || 'הצלם שלך'} העלה לך ${file_count || ''} קבצים חדשים.\n\nהיכנס למערכת כדי להוריד אותם — הקבצים יישמרו במערכת ל-3 חודשים בלבד.\n\nתודה!`
      });
    } catch (e) {
      console.error('Email send failed:', e.message);
    }

    // Send Push
    try {
      const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: client_email, is_active: true });
      if (subs.length > 0) {
        const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
        webpush.setVapidDetails('mailto:noreply@base44.app', vapidPublic, vapidPrivate);

        const payload = JSON.stringify({
          title: '📸 קבצים חדשים זמינים!',
          body: `${photographer.full_name || 'הצלם שלך'} העלה לך קבצים חדשים`,
          icon: '/icon-192.png',
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            }, payload);
          } catch (e) {
            console.error('Push send failed for', sub.endpoint, e.message);
          }
        }
      }
    } catch (e) {
      console.error('Push notification error:', e.message);
    }

    // Update client's expire_at to 3 months from now
    try {
      const clientUsers = await base44.asServiceRole.entities.User.filter({ email: client_email });
      if (clientUsers.length > 0) {
        const expireAt = new Date();
        expireAt.setMonth(expireAt.getMonth() + 3);
        await base44.asServiceRole.entities.User.update(clientUsers[0].id, {
          client_files_expire_at: expireAt.toISOString(),
          last_reminder_sent_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('User update failed:', e.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('notifyClientNewFiles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});