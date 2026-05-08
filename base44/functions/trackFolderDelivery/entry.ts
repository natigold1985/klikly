import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const CONSENT_TEXT = 'I confirm that I am downloading these files. I acknowledge that storage is provided for 90 days only. After this period, BASE 44 and the photographer are not responsible for file retention.';

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
      downloaded_at: isDownload ? now : link?.downloaded_at,
      fully_saved_at: isDownload ? now : link?.fully_saved_at,
      last_bulk_download_count: file_count || link?.last_bulk_download_count || 0,
    };
    if (link) await base44.asServiceRole.entities.DeliveryLink.update(link.id, linkPayload).catch(() => {});
    else await base44.asServiceRole.entities.DeliveryLink.create(linkPayload).catch(() => {});

    if (isDownload) {
      if (!project.first_download_at) {
        await base44.asServiceRole.entities.Project.update(project.id, { first_download_at: now, last_bulk_download_at: now, last_bulk_download_count: file_count || 0 }).catch(() => {});
      } else {
        await base44.asServiceRole.entities.Project.update(project.id, { last_bulk_download_at: now, last_bulk_download_count: file_count || 0 }).catch(() => {});
      }
      await notifyClient(base44, project);
      await notifyPhotographer(base44, project, file_count || 0);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('trackFolderDelivery error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function notifyClient(base44, project) {
  if (!project.client_email) return;
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: project.client_email,
    subject: 'Success! הקבצים שלך נשמרים',
    body: `Success! Your memories from ${project.project_name || project.shooting_type || 'Studio Gold'} are being saved. Remember: your link expires in 90 days.`,
  }).catch(() => {});
}

async function notifyPhotographer(base44, project, fileCount) {
  const photographerEmail = project.created_by;
  if (!photographerEmail) return;
  const projectTitle = project.project_name || project.shooting_type || 'Project';
  const message = `Liability Protected: ${project.client_name || 'Client'} has officially confirmed receipt and started downloading ${projectTitle}. (${fileCount} files)`;
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: photographerEmail,
    subject: 'Liability Protected: client confirmed download',
    body: message,
  }).catch(() => {});

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