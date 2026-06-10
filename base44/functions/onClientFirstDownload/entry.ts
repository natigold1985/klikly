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

    // If first login/download — notify photographer via email
    if (isFirstDownload && photographerEmail) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: photographerEmail,
          from_name: 'KLIKLY',
          subject: `🎉 הלקוח ${me.full_name || me.email} התחבר לגלריה לראשונה`,
          body: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center;">
          <span style="color:#FFD700;font-size:26px;font-weight:900;letter-spacing:2px;">KLIKLY</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h2 style="color:#0a0a0a;font-size:20px;margin:0 0 16px;">🎉 הלקוח התחבר לגלריה!</h2>
          <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 16px;">
            <strong>${me.full_name || me.email}</strong> נכנס לגלריה שלו לראשונה${file_name ? ` והוריד את "${file_name}"` : ''}.
          </p>
          <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
            שעון 90 הימים להורדת הקבצים התחיל לרוץ מעכשיו.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="https://app.klikly.com/FileStorage" style="display:inline-block;background:#FFD700;color:#000;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;">
              📁 לצפייה בפרויקטים
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="color:#999;font-size:12px;margin:0;">הודעה אוטומטית מ-KLIKLY</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
        console.log('Photographer notified of first client login:', me.email);
      } catch (e) {
        console.error('photographer first-login email failed:', e.message);
      }
    }

    // Confirm to client via email on first download
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