import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import MailComposer from 'npm:nodemailer@6.9.16/lib/mail-composer/index.js';

const ADMIN_EMAIL = 'natigold04@gmail.com';
const CLIENT_APP_ORIGIN = 'https://klikly.base44.app';

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
      const allowed = me.role === 'admin' || me.role === 'user' || me.role === 'photographer' || me.email === ADMIN_EMAIL || project.created_by === me.email || project.created_by_id === me.id;
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientEmails = project
      ? [...new Set([project.client_email, ...(Array.isArray(project.client_emails) ? project.client_emails : [])].filter(Boolean).map((email) => String(email).trim().toLowerCase()).filter(isValidEmail))]
      : [client_email].filter(Boolean).map((email) => String(email).trim().toLowerCase()).filter(isValidEmail);

    if (!clientEmails.length) return Response.json({ error: 'Missing valid client email' }, { status: 400 });

    const galleryUrl = normalizeClientUrl(gallery_url || buildGalleryUrl(req, project));
    const projectTitle = project?.project_name || project?.shooting_type || 'תיקיית הקבצים שלך';
    const fileCountText = file_count ? `${file_count} קבצים` : 'קבצים';
    const isGalleryShare = notification_type === 'gallery_sent' || !!galleryUrl;
    const subject = isGalleryShare ? `📁 תיקיית הקבצים שלך מוכנה - ${project?.client_name || ''}` : `📸 ${fileCountText} זמינים לפרויקט שלך`;
    const bodyHtml = buildClientEmail({ project, galleryUrl, message, fileCountText, isGalleryShare });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const fromEmail = await getGmailAddress(accessToken);
    const clientSent = [];
    const clientFailed = [];
    for (const email of clientEmails) {
      try {
        await sendGmailEmail(accessToken, fromEmail, { to: email, subject, body: bodyHtml });
        clientSent.push(email);
      } catch (error) {
        clientFailed.push({ email, error: error.message });
      }
    }

    const adminSent = [];
    const adminFailed = [];
    if (clientSent.length > 0) {
      const adminRecipients = [...new Set([ADMIN_EMAIL, project?.created_by].filter(Boolean).map((email) => String(email).trim().toLowerCase()).filter(isValidEmail))];
      for (const email of adminRecipients) {
        try {
          await sendGmailEmail(accessToken, fromEmail, {
            to: email,
            subject: `✅ נשלח קישור הורדה ללקוח - ${project?.client_name || clientSent[0]}`,
            body: buildAdminEmail({ project, clientEmails, galleryUrl, sent: clientSent, failed: clientFailed, message }),
          });
          adminSent.push(email);
        } catch (error) {
          adminFailed.push({ email, error: error.message });
        }
      }
    }

    const sent = [...clientSent, ...adminSent];
    const failed = [...clientFailed, ...adminFailed];
    const status = clientSent.length ? (adminFailed.length ? 'pending' : 'success') : 'error';
    const details = `Gallery/files email action. Project: ${project?.id || 'none'}, clients: ${clientEmails.join(', ')}, client sent: ${clientSent.join(', ')}, admin sent: ${adminSent.join(', ')}, failed: ${failed.map((f) => `${f.email}: ${f.error}`).join(' | ')}, link: ${galleryUrl || ''}`;
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
        title: isGalleryShare ? 'נשלח מייל הורדת תיקייה ללקוח' : 'נשלח מייל על קבצים חדשים',
        description: details,
        metadata: { client_emails: clientEmails, client_sent: clientSent, admin_sent: adminSent, failed, gallery_url: galleryUrl || '' },
      }).catch(() => {});
    }

    return Response.json({
      success: clientSent.length > 0,
      client_sent: clientSent,
      admin_sent: adminSent,
      sent_to: sent,
      failed,
      gallery_url: galleryUrl,
      admin_copy_sent: adminSent.includes(ADMIN_EMAIL),
    });
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
  return `${CLIENT_APP_ORIGIN}/gallery/${folderId}`;
}

function normalizeClientUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${CLIENT_APP_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_) {
    return url;
  }
}

async function getGmailAddress(accessToken) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return ADMIN_EMAIL;
  const data = await res.json();
  return data.emailAddress || ADMIN_EMAIL;
}

async function sendGmailEmail(accessToken, fromEmail, { to, subject, body }) {
  const composer = new MailComposer({
    from: `KLIKLY <${fromEmail}>`,
    to,
    subject,
    html: body,
  });
  const message = await composer.compile().build();
  const raw = base64UrlEncode(new Uint8Array(message));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Gmail send failed ${res.status}`);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function base64UrlEncode(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildClientEmail({ project, galleryUrl, message, fileCountText, isGalleryShare }) {
  const clientName = project?.client_name || '';
  const projectTitle = project?.project_name || project?.shooting_type || 'תיקיית הקבצים שלך';
  const text = message || (isGalleryShare ? 'תיקיית הקבצים שלך מוכנה להורדה. לחץ/י על הכפתור למטה כדי להתחיל הורדה.' : `${fileCountText} חדשים זמינים עבורך.`);
  const button = isGalleryShare ? '📁 פתיחת הורדה' : '📁 כניסה לקבצים';
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head><body style="margin:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;direction:rtl;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;"><tr><td style="background:#0a0a0a;padding:30px;text-align:center;border-bottom:2px solid #FFD700;"><img src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" alt="KLIKLY" style="height:78px;display:block;margin:0 auto 10px;"/><div style="color:#FFD700;font-size:28px;font-weight:900;letter-spacing:4px;">KLIKLY</div></td></tr><tr><td style="background:linear-gradient(135deg,#FFD700,#D4AF37);padding:26px;text-align:center;color:#000;"><div style="font-size:34px;margin-bottom:8px;">${isGalleryShare ? '🎉' : '📁'}</div><h1 style="margin:0;font-size:24px;font-weight:900;">${escapeHtml(projectTitle)}</h1></td></tr><tr><td style="padding:34px 40px;color:#ccc;"><p style="font-size:18px;line-height:1.7;margin:0 0 12px;">היי ${escapeHtml(clientName)} 👋</p><p style="font-size:16px;line-height:1.8;margin:0 0 26px;color:#aaa;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>${galleryUrl ? `<div style="text-align:center;margin:28px 0;"><a href="${escapeHtml(galleryUrl)}" style="display:inline-block;background:#FFD700;color:#000;font-size:17px;font-weight:900;padding:17px 48px;border-radius:14px;text-decoration:none;">${button}</a></div><div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;direction:ltr;text-align:left;color:#888;font-size:12px;word-break:break-all;">${escapeHtml(galleryUrl)}</div>` : ''}<p style="color:#555;font-size:11px;text-align:center;margin:24px 0 0;">הודעה אוטומטית מ-KLIKLY · לא להשיב למייל זה</p></td></tr></table></td></tr></table></body></html>`;
}

function buildAdminEmail({ project, clientEmails, galleryUrl, sent, failed, message }) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;"><h2>✅ סטטוס שליחת קישור הורדה</h2><p><strong>לקוח:</strong> ${escapeHtml(project?.client_name || '')}</p><p><strong>נמענים:</strong> ${escapeHtml(clientEmails.join(', '))}</p><p><strong>נשלח בהצלחה:</strong> ${escapeHtml(sent.join(', ') || 'אין')}</p><p><strong>נכשל:</strong> ${escapeHtml(failed.map((f) => `${f.email}: ${f.error}`).join(' | ') || 'אין')}</p>${message ? `<p><strong>הודעה:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}${galleryUrl ? `<p><a href="${escapeHtml(galleryUrl)}">פתיחת קישור ההורדה</a></p>` : ''}</div>`;
}