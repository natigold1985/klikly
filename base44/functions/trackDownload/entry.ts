// Tracks a client download event from the Magic Link gallery.
// - Logs to SystemLog
// - Sends push + email notification to photographer
// - Sets first_download_at on Project (starts 90-day retention if not already set)
// Called PUBLICLY (no auth) — secured via project's client_access_token.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, file_name, download_type, file_count } = await req.json().catch(() => ({}));

    if (!token) return Response.json({ error: 'token required' }, { status: 400 });

    const list = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
    const project = list[0];
    if (!project) return Response.json({ error: 'Invalid token' }, { status: 404 });

    const isDownloadAll = download_type === 'download_all';
    const countText = file_count ? ` (${file_count} קבצים)` : '';

    // Log
    await base44.asServiceRole.entities.SystemLog.create({
      action: 'client_download',
      details: `[${download_type || 'single'}] ${project.client_name} downloaded ${file_name || 'files'}${countText}`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project.id,
      owner_id: project.created_by,
    }).catch(() => {});

    // Persist last bulk-download timestamp + count on project (for tracking)
    if (isDownloadAll) {
      await base44.asServiceRole.entities.Project.update(project.id, {
        last_bulk_download_at: new Date().toISOString(),
        last_bulk_download_count: file_count || 0,
      }).catch(() => {});
    }

    // Start 90-day retention on first download
    const isFirst = !project.first_download_at;
    if (isFirst) {
      await base44.asServiceRole.entities.Project.update(project.id, {
        first_download_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // Notify photographer (push)
    const photographerEmail = project.created_by;
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
          const title = isDownloadAll ? '🎉 הלקוח הוריד את כל הגלריה' : '⬇️ הלקוח הוריד קבצים';
          const body = isDownloadAll
            ? `${project.client_name} הוריד את הגלריה המלאה${countText}`
            : `${project.client_name}${file_name ? ` הוריד "${file_name}"` : ' הוריד קבצים'}${isFirst ? ' (הורדה ראשונה!)' : ''}`;
          const payload = JSON.stringify({
            title,
            body,
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
                await base44.asServiceRole.entities.PushSubscription.delete(sub.id).catch(() => {});
              }
            }
          }
        }

        // Email photographer too
        const emailSubject = isDownloadAll ? '🎉 הלקוח הוריד את כל הגלריה' : '⬇️ הלקוח הוריד קבצים';
        const emailBody = isDownloadAll
          ? `${project.client_name} הוריד את הגלריה המלאה${countText}.\n\nתאריך: ${new Date().toLocaleString('he-IL')}`
          : `${project.client_name} הוריד${file_name ? ` "${file_name}"` : ' קבצים'}${isFirst ? ' (הורדה ראשונה!)' : ''}.\n\nתאריך: ${new Date().toLocaleString('he-IL')}`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: photographerEmail,
          subject: emailSubject,
          body: emailBody,
        }).catch(() => {});
      } catch (e) {
        console.error('photographer notify failed:', e.message);
      }
    }

    return Response.json({ success: true, first_download: isFirst });
  } catch (error) {
    console.error('trackDownload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});