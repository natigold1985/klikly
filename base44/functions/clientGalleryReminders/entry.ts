import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;
const DAY_83 = 83 * 24 * 60 * 60 * 1000;
const DAY_84 = 84 * 24 * 60 * 60 * 1000;

function buildWhatsAppLink(phone, message) {
  if (!phone) return '';
  const clean = String(phone).replace(/[^0-9]/g, '');
  const intl = clean.startsWith('0') ? `972${clean.slice(1)}` : clean;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const links = await base44.asServiceRole.entities.DeliveryLink.list('-updated_date', 500);
    let sent = 0;

    for (const link of links) {
      if (!link.wants_reminders) continue;

      const clientName = link.client_name || 'לקוח יקר';
      const projectTitle = link.project_title || 'הגלריה שלך';
      const galleryPath = String(link.token || '').startsWith('folder:') ? `/gallery/${String(link.token).replace('folder:', '')}` : `/g/${link.token}`;
      const lastSent = link.last_notification_sent ? new Date(link.last_notification_sent) : null;

      let message = '';
      let reminderType = '48h_no_download';

      if (!link.downloaded_at && !link.fully_saved_at) {
        const openedAt = new Date(link.reminder_consent_at || link.updated_date || link.created_date);
        if (Number.isNaN(openedAt.getTime()) || now - openedAt < HOURS_48) continue;
        if (lastSent && now - lastSent < HOURS_24) continue;
        message = `היי ${clientName}, תזכורת ידידותית לוודא ששמרת את כל הקבצים מהגלריה: ${projectTitle}. ${galleryPath}`;
      } else {
        const downloadedAt = new Date(link.downloaded_at || link.fully_saved_at);
        if (Number.isNaN(downloadedAt.getTime())) continue;
        const age = now - downloadedAt;
        if (age < DAY_83 || age >= DAY_84) continue;
        if (lastSent && now - lastSent < HOURS_24) continue;
        reminderType = 'day83_final_warning';
        message = `אזהרה אחרונה: הגלריה ${projectTitle} תישמר עד 90 יום בלבד. מומלץ לוודא שכל הקבצים נשמרו אצלך. ${galleryPath}`;
      }
      const waLink = buildWhatsAppLink(link.client_phone, message);

      if (link.client_email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: link.client_email,
          subject: '📸 תזכורת לשמירת כל קבצי הגלריה',
          body: `${message}${waLink ? `\n\nWhatsApp: ${waLink}` : ''}`,
        }).catch(() => {});
      }

      await base44.asServiceRole.entities.SystemLog.create({
        action: reminderType === 'day83_final_warning' ? 'client_gallery_final_warning_sent' : 'client_gallery_reminder_sent',
        details: `${reminderType} sent for ${clientName}. WhatsApp link: ${waLink || 'no phone'}`,
        status: 'success',
        related_entity_type: 'DeliveryLink',
        related_entity_id: link.id,
        owner_id: link.photographer_email,
      }).catch(() => {});

      await base44.asServiceRole.entities.DeliveryLink.update(link.id, {
        last_notification_sent: now.toISOString(),
      });
      sent++;
    }

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error('clientGalleryReminders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});