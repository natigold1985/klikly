// Runs daily. For each client whose 90-day retention clock has started:
//  - if expire_at has passed: delete all their photos and clear flags
//  - else: check the days-since-first-download, and send reminder at milestones 30/60/75/85
//    (each milestone sent only once via reminder_milestones_sent)
//  - reminders go via email + WhatsApp deep-link (in email body) + push
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const MILESTONES = [30, 60, 75, 85]; // days since first_download_at

function buildWhatsAppLink(phone, message) {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.substring(1) : clean;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list();
    const clients = allUsers.filter(u => u.role === 'client' && u.first_download_at);
    const now = new Date();

    let remindersSent = 0;
    let filesDeleted = 0;

    const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
    const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails('mailto:noreply@base44.app', vapidPublic, vapidPrivate);
    }

    for (const client of clients) {
      const firstDownload = new Date(client.first_download_at);
      const expireAt = client.client_files_expire_at
        ? new Date(client.client_files_expire_at)
        : new Date(firstDownload.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Files expired -> delete
      if (now >= expireAt) {
        const photos = await base44.asServiceRole.entities.Photo.filter({ client_email: client.email });
        for (const p of photos) {
          await base44.asServiceRole.entities.Photo.delete(p.id);
          filesDeleted++;
        }
        await base44.asServiceRole.entities.User.update(client.id, {
          client_files_expire_at: null,
          first_download_at: null,
          last_reminder_sent_at: null,
          reminder_milestones_sent: [],
        });
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: client.email,
            subject: '⏰ הקבצים שלך נמחקו (תקופת השמירה הסתיימה)',
            body: `שלום ${client.full_name || ''},\n\nתקופת השמירה של 90 ימים הסתיימה והקבצים שלך נמחקו מהמערכת.\nאם אתה זקוק לעותק — פנה לצלם שלך.`,
          });
        } catch (_) {}
        continue;
      }

      // Compute days since first download
      const daysSinceStart = Math.floor((now - firstDownload) / (1000 * 60 * 60 * 24));
      const sentMilestones = client.reminder_milestones_sent || [];
      const dueMilestone = MILESTONES.find(m => daysSinceStart >= m && !sentMilestones.includes(m));
      if (dueMilestone === undefined) continue;

      const photos = await base44.asServiceRole.entities.Photo.filter({ client_email: client.email });
      if (photos.length === 0) {
        // Nothing to remind about — mark as sent so we don't re-evaluate
        await base44.asServiceRole.entities.User.update(client.id, {
          reminder_milestones_sent: [...sentMilestones, dueMilestone],
        });
        continue;
      }

      const daysLeft = Math.max(1, Math.ceil((expireAt - now) / (1000 * 60 * 60 * 24)));
      const subject = `📸 נותרו ${daysLeft} ימים להורדת הקבצים שלך`;
      const waLink = buildWhatsAppLink(
        client.phone,
        `שלום ${client.full_name || ''}, נותרו ${daysLeft} ימים להורדת הקבצים שלך לפני שיימחקו אוטומטית מהמערכת.`
      );
      const body = `שלום ${client.full_name || ''},\n\nיש לך ${photos.length} קבצים זמינים להורדה.\nהקבצים יימחקו אוטומטית בעוד ${daysLeft} ימים.\n\nהיכנס למערכת כדי להוריד אותם.${
        waLink ? `\n\nלהזכרה גם ב-WhatsApp: ${waLink}` : ''
      }`;

      // Email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: client.email,
          subject,
          body,
        });
      } catch (_) {}

      // Push
      try {
        const subs = await base44.asServiceRole.entities.PushSubscription.filter({
          user_email: client.email,
          is_active: true,
        });
        const payload = JSON.stringify({
          title: `📸 ${photos.length} קבצים מחכים לך`,
          body: `נותרו ${daysLeft} ימים להורדה`,
          icon: '/icon-192.png',
          url: '/FileStorage',
        });
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
              payload
            );
          } catch (_) {}
        }
      } catch (_) {}

      await base44.asServiceRole.entities.User.update(client.id, {
        last_reminder_sent_at: now.toISOString(),
        reminder_milestones_sent: [...sentMilestones, dueMilestone],
      });
      remindersSent++;
    }

    return Response.json({ success: true, remindersSent, filesDeleted });
  } catch (error) {
    console.error('clientFileReminders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});