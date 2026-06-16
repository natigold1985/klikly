import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_EMAIL = 'natigold04@gmail.com';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, client_email, file_count, gallery_url, message, notification_type } = body;
    let project = null;
    if (project_id) {
      project = await base44.asServiceRole.entities.Project.get(project_id);
      const allowed = me.role === 'admin' || me.email === ADMIN_EMAIL || project.created_by === me.email || project.created_by_id === me.id;
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientEmails = project
      ? [...new Set([project.client_email, ...(Array.isArray(project.client_emails) ? project.client_emails : [])].filter(Boolean).map((email) => String(email).trim().toLowerCase()))]
      : [client_email].filter(Boolean).map((email) => String(email).trim().toLowerCase());

    if (!clientEmails.length) return Response.json({ error: 'Missing client_email' }, { status: 400 });

    const galleryUrl = gallery_url || buildGalleryUrl(req, project);
    const projectTitle = project?.project_name || project?.shooting_type || 'הגלריה שלך';
    const fileCountText = file_count ? `${file_count} קבצים` : 'קבצים';
    const isGalleryShare = notification_type === 'gallery_sent' || !!galleryUrl;
    const subject = isGalleryShare ? `📸 הגלריה שלך מוכנה - ${project?.client_name || ''}` : `📸 ${fileCountText} זמינים לפרויקט שלך`;
    const bodyHtml = buildClientEmail({ project, galleryUrl, message, fileCountText, isGalleryShare });

    const sent = [];
    const failed = [];
    for (const email of clientEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, from_name: 'KLIKLY', subject, body: bodyHtml });
        sent.push(email);
      } catch (error) {
        failed.push({ email, error: error.message });
      }
    }

    const adminRecipients = [...new Set([ADMIN_EMAIL, project?.created_by].filter(Boolean).map((email) => String(email).trim().toLowerCase()))];
    for (const email of adminRecipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          from_name: 'KLIKLY',
          subject: `✅ נשלחה גלריה ללקוח - ${project?.client_name || clientEmails[0]}`,
          body: buildAdminEmail({ project, clientEmails, galleryUrl, sent, failed, message }),
        });
        sent.push(email);
      } catch (error) {
        failed.push({ email, error: error.message });
      }
    }

    const status = failed.length ? (sent.length ? 'pending' : 'error') : 'success';
    const details = `Gallery/files email action. Project: ${project?.id || 'none'}, clients: ${clientEmails.join(', ')}, sent: ${sent.join(', ')}, failed: ${failed.map((f) => `${f.email}: ${f.error}`).join(' | ')}, link: ${galleryUrl || ''}`;
    await base44.asServiceRole.entities.SystemLog.create({
      action: isGalleryShare ? 'gallery_email_sent' : 'client_files_email_sent',
      details,
      status,
      related_entity_type: project ? 'Project' : 'Email',
      related_entity_id: project?.id || '',
      owner_id: project?.created_by_id || project?.created_by || me.id,
    }).catch(() => {});

    if (project) {
      await base44.asServiceRole.entities.Activity.create({
        related_to_type: 'project',
        related_to_id: project.id,
        activity_type: 'email_sent',
        title: isGalleryShare ? 'נשלח מייל גלריה ללקוח' : 'נשלח מייל על קבצים חדשים',
        description: details,
        metadata: { client_emails: clientEmails, sent, failed, gallery_url: galleryUrl || '' },
      }).catch(() => {});
    }

    return Response.json({ success: failed.length === 0, sent_to: sent, failed, gallery_url: galleryUrl });
  } catch (error) {
    console.error('notifyClientNewFiles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildGalleryUrl(req, project) {
  if (!project?.drive_folder_url) return '';
  const match = String(project.drive_folder_url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  const folderId = match?.[1] || '';
  if (!folderId) return '';
  const origin = req.headers.get('origin') || (req.headers.get('referer') ? new URL(req.headers.get('referer')).origin : 'https://klikly.base44.app');
  return `${origin}/gallery/${folderId}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildClientEmail({ project, galleryUrl, message, fileCountText, isGalleryShare }) {
  const clientName = project?.client_name || '';
  const projectTitle = project?.project_name || project?.shooting_type || 'הגלריה שלך';
  const text = message || (isGalleryShare ? 'הגלריה שלך מוכנה לצפייה ולהורדה. לחץ/י על הכפתור למטה כדי לפתוח את הקישור.' : `${fileCountText} חדשים זמינים עבורך.`);
  const button = isGalleryShare ? '📸 פתיחת הגלריה' : '📁 כניסה לקבצים';
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head><body style="margin:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;direction:rtl;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;"><tr><td style="background:#0a0a0a;padding:30px;text-align:center;border-bottom:2px solid #FFD700;"><img src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" alt="KLIKLY" style="height:78px;display:block;margin:0 auto 10px;"/><div style="color:#FFD700;font-size:28px;font-weight:900;letter-spacing:4px;">KLIKLY</div></td></tr><tr><td style="background:linear-gradient(135deg,#FFD700,#D4AF37);padding:26px;text-align:center;color:#000;"><div style="font-size:34px;margin-bottom:8px;">${isGalleryShare ? '🎉' : '📁'}</div><h1 style="margin:0;font-size:24px;font-weight:900;">${escapeHtml(projectTitle)}</h1></td></tr><tr><td style="padding:34px 40px;color:#ccc;"><p style="font-size:18px;line-height:1.7;margin:0 0 12px;">היי ${escapeHtml(clientName)} 👋</p><p style="font-size:16px;line-height:1.8;margin:0 0 26px;color:#aaa;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>${galleryUrl ? `<div style="text-align:center;margin:28px 0;"><a href="${escapeHtml(galleryUrl)}" style="display:inline-block;background:#FFD700;color:#000;font-size:17px;font-weight:900;padding:17px 48px;border-radius:14px;text-decoration:none;">${button}</a></div><div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;direction:ltr;text-align:left;color:#888;font-size:12px;word-break:break-all;">${escapeHtml(galleryUrl)}</div>` : ''}<p style="color:#555;font-size:11px;text-align:center;margin:24px 0 0;">הודעה אוטומטית מ-KLIKLY · לא להשיב למייל זה</p></td></tr></table></td></tr></table></body></html>`;
}

function buildAdminEmail({ project, clientEmails, galleryUrl, sent, failed, message }) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;"><h2>✅ סטטוס שליחת גלריה</h2><p><strong>לקוח:</strong> ${escapeHtml(project?.client_name || '')}</p><p><strong>נמענים:</strong> ${escapeHtml(clientEmails.join(', '))}</p><p><strong>נשלח בהצלחה:</strong> ${escapeHtml(sent.join(', ') || 'אין')}</p><p><strong>נכשל:</strong> ${escapeHtml(failed.map((f) => `${f.email}: ${f.error}`).join(' | ') || 'אין')}</p>${message ? `<p><strong>הודעה:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}${galleryUrl ? `<p><a href="${escapeHtml(galleryUrl)}">פתיחת קישור הגלריה</a></p>` : ''}</div>`;
}