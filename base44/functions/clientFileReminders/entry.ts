import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Runs weekly. For each client with active files:
//  - if expire_at passed: delete all their photos
//  - else if last reminder > 7 days ago: send reminder push + email
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list();
    const clients = allUsers.filter(u => u.role === 'client' && u.client_files_expire_at);
    const now = new Date();

    let remindersSent = 0;
    let filesDeleted = 0;

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails('mailto:noreply@base44.app', vapidPublic, vapidPrivate);
    }

    for (const client of clients) {
      const expireAt = new Date(client.client_files_expire_at);

      // Files expired -> delete
      if (now >= expireAt) {
        const photos = await base44.asServiceRole.entities.Photo.filter({ client_email: client.email });
        for (const p of photos) {
          await base44.asServiceRole.entities.Photo.delete(p.id);
          filesDeleted++;
        }
        await base44.asServiceRole.entities.User.update(client.id, {
          client_files_expire_at: null,
          last_reminder_sent_at: null,
        });
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: client.email,
            subject: '⏰ הקבצים שלך נמחקו (תקופת השמירה הסתיימה)',
            body: `שלום ${client.full_name || ''},\n\nתקופת השמירה של 3 חודשים הסתיימה והקבצים שלך נמחקו מהמערכת.\nאם אתה זקוק לעותק — פנה לצלם שלך.`,
          });
        } catch (_) {}
        continue;
      }

      // Send weekly reminder
      const lastReminder = client.last_reminder_sent_at ? new Date(client.last_reminder_sent_at) : null;
      const daysSinceReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60 * 24) : 999;

      if (daysSinceReminder >= 7) {
        const photos = await base44.asServiceRole.entities.Photo.filter({ client_email: client.email });
        if (photos.length === 0) continue;

        const daysLeft = Math.ceil((expireAt - now) / (1000 * 60 * 60 * 24));

        // Email
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: client.email,
            subject: `📸 יש לך ${photos.length} קבצים שמחכים — נותרו ${daysLeft} ימים`,
            body: `שלום ${client.full_name || ''},\n\nיש לך ${photos.length} קבצים זמינים להורדה.\nהקבצים יימחקו אוטומטית בעוד ${daysLeft} ימים.\n\nהיכנס למערכת כדי להוריד אותם.`,
          });
        } catch (_) {}

        // Push
        try {
          const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: client.email, is_active: true });
          const payload = JSON.stringify({
            title: `📸 ${photos.length} קבצים מחכים לך`,
            body: `נותרו ${daysLeft} ימים להורדה`,
          });
          for (const sub of subs) {
            try {
              await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
              }, payload);
            } catch (_) {}
          }
        } catch (_) {}

        await base44.asServiceRole.entities.User.update(client.id, {
          last_reminder_sent_at: now.toISOString(),
        });
        remindersSent++;
      }
    }

    return Response.json({ success: true, remindersSent, filesDeleted });
  } catch (error) {
    console.error('clientFileReminders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});