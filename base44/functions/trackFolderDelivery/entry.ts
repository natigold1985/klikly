import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const ADMIN_EMAIL = 'natigold04@gmail.com';
const CONSENT_TEXT = 'באישור זה אני מאשר/ת שקיבלתי גישה לקבצי הפרויקט ומתחיל/ה בהורדתם למכשיר האישי שלי. ידוע לי כי STUDIO GOLD והצלם שומרים גיבוי זמני של הקבצים למשך עד 90 ימים ממועד מסירת הקישור או תחילת ההורדה, ולאחר תקופה זו לא תהיה ל-STUDIO GOLD, לצלם או למי מטעמם כל אחריות לשמירה, שחזור, אובדן או מחיקה של הקבצים. באחריותי לוודא שהקבצים ירדו ונשמרו אצלי באופן תקין.';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { folder_id, action_type, file_count } = await req.json().catch(() => ({}));
    if (!folder_id || !action_type) return Response.json({ error: 'folder_id and action_type required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);
    const project = projects.find((p) => String(p.drive_folder_url || '').includes(folder_id));
    if (!project) return Response.json({ error: 'Gallery not found' }, { status: 404 });

    const now = new Date().toISOString();
    const isDownload = ['download_confirmed', 'download_started', 'download_completed'].includes(action_type);
    const isDownloadCompleted = action_type === 'download_completed';

    await base44.asServiceRole.entities.DeliveryAudit.create({
      project_id: project.id,
      folder_id,
      client_name: project.client_name,
      client_email: project.client_email,
      project_title: project.project_name || project.shooting_type || 'Gallery',
      action_type,
      ip_address: getIp(req),
      user_agent: req.headers.get('user-agent') || '',
      file_count: file_count || 0,
      consent_text: isDownload ? CONSENT_TEXT : '',
    });

    const token = `folder:${folder_id}`;
    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token }).catch(() => []);
    const link = links[0];
    const linkPayload = {
      project_id: project.id,
      token,
      file_url: project.drive_folder_url || '',
      photographer_email: project.created_by,
      client_name: project.client_name,
      client_email: project.client_email,
      client_phone: project.client_phone,
      project_title: project.project_name || project.shooting_type || 'Gallery',
      wants_reminders: true,
      is_downloaded: isDownloadCompleted ? true : link?.is_downloaded || false,
      downloaded_at: isDownloadCompleted ? now : link?.downloaded_at,
      fully_saved_at: isDownloadCompleted ? now : link?.fully_saved_at,
      last_bulk_download_count: file_count || link?.last_bulk_download_count || 0,
    };
    if (link) await base44.asServiceRole.entities.DeliveryLink.update(link.id, linkPayload).catch(() => {});
    else await base44.asServiceRole.entities.DeliveryLink.create(linkPayload).catch(() => {});

    if (isDownloadCompleted) {
      if (!project.first_download_at) {
        await base44.asServiceRole.entities.Project.update(project.id, { first_download_at: now, last_bulk_download_at: now, last_bulk_download_count: file_count || 0 }).catch(() => {});
      } else {
        await base44.asServiceRole.entities.Project.update(project.id, { last_bulk_download_at: now, last_bulk_download_count: file_count || 0 }).catch(() => {});
      }
      const details = `Client ${project.client_name || project.client_email || project.id} confirmed receipt and opened direct download for ${file_count || 0} files. Project: ${project.project_name || project.shooting_type || project.id}. Consent: ${CONSENT_TEXT}`;
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'storage_client_download_confirmed',
        details,
        status: 'success',
        related_entity_type: 'Project',
        related_entity_id: project.id,
        owner_id: project.created_by_id || project.created_by || '',
      }).catch(() => {});
      await base44.asServiceRole.entities.Activity.create({
        related_to_type: 'project',
        related_to_id: project.id,
        activity_type: 'selection_made',
        title: 'לקוח אישר קבלת קבצים והתחיל הורדה',
        description: details,
        metadata: { folder_id, file_count: file_count || 0, consent_text: CONSENT_TEXT, downloaded_at: now },
      }).catch(() => {});
      await notifyClient(base44, project, file_count || 0);
      await notifyPhotographer(base44, project, file_count || 0);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('trackFolderDelivery error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function notifyClient(base44, project, fileCount) {
  const recipients = [...new Set([project.client_email, ...(Array.isArray(project.client_emails) ? project.client_emails : [])].filter(Boolean).map((email) => String(email).trim().toLowerCase()))];
  const projectTitle = project.project_name || project.shooting_type || 'Studio Gold';
  for (const email of recipients) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'אישור קבלת הקבצים שלך מ-STUDIO GOLD',
      body: `שלום ${project.client_name || ''},\n\nאישורך התקבל במערכת והורדת הקבצים עבור ${projectTitle} נפתחה במכשיר שלך.\n\nמספר קבצים: ${fileCount}\n\n${CONSENT_TEXT}\n\nSTUDIO GOLD`,
    }).catch(() => {});
  }
}

async function notifyPhotographer(base44, project, fileCount) {
  const recipients = [...new Set([ADMIN_EMAIL, project.created_by].filter(Boolean).map((email) => String(email).trim().toLowerCase()))];
  const photographerEmail = project.created_by || ADMIN_EMAIL;
  const projectTitle = project.project_name || project.shooting_type || 'Project';
  const message = `לקוח אישר קבלת קבצים והתחיל הורדה.\n\nלקוח: ${project.client_name || project.client_email || 'Client'}\nפרויקט: ${projectTitle}\nמספר קבצים: ${fileCount}\n\n${CONSENT_TEXT}`;
  for (const email of recipients) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'STUDIO GOLD: לקוח אישר קבלת קבצים',
      body: message,
    }).catch(() => {});
  }

  const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
  const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
  if (!vapidPublic || !vapidPrivate) return;
  webpush.setVapidDetails('mailto:noreply@base44.app', vapidPublic, vapidPrivate);
  const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: photographerEmail, is_active: true }).catch(() => []);
  const payload = JSON.stringify({ title: 'Liability Protected', body: message, icon: '/icon-192.png', url: '/FileStorage' });
  for (const sub of subs) {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } }, payload).catch(() => {});
  }
}

function getIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}