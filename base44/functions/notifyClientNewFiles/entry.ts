import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_email, file_count } = body;
    if (!client_email) return Response.json({ error: 'Missing client_email' }, { status: 400 });

    const photographer = me;

    // Send Email
    try {
      const appUrl = 'https://app.klikly.com';
      const galleryUrl = `${appUrl}/FileStorage`;
      const photographerName = photographer.full_name || 'הצלם שלך';
      const fileCountText = file_count ? `${file_count} קבצים חדשים` : 'קבצים חדשים';

      const emailHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);padding:32px 40px;text-align:center;border-bottom:2px solid #FFD700;">
          <div style="color:#FFD700;font-size:32px;font-weight:900;letter-spacing:4px;text-shadow:0 0 20px rgba(255,215,0,0.3);">KLIKLY</div>
          <div style="color:#888;font-size:12px;letter-spacing:2px;margin-top:4px;text-transform:uppercase;">מערכת ניהול גלריות מקצועית</div>
        </td></tr>

        <!-- Hero Banner -->
        <tr><td style="background:linear-gradient(135deg,#FFD700 0%,#D4AF37 100%);padding:28px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">📸</div>
          <h1 style="color:#000;font-size:24px;font-weight:900;margin:0;letter-spacing:1px;">קבצים חדשים זמינים!</h1>
          <p style="color:#1a1a1a;font-size:14px;margin:8px 0 0;font-weight:600;">${fileCountText} מחכים לך</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 28px;">
          <p style="color:#cccccc;font-size:18px;line-height:1.7;margin:0 0 12px;">שלום 👋</p>
          <p style="color:#aaaaaa;font-size:16px;line-height:1.7;margin:0 0 24px;">
            <strong style="color:#FFD700;">${photographerName}</strong> העלה עבורך <strong style="color:#fff;">${fileCountText}</strong> במערכת KLIKLY.
          </p>

          <!-- Warning Box -->
          <div style="background:#1f1a00;border:1px solid #FFD700;border-right:4px solid #FFD700;border-radius:10px;padding:16px 20px;margin:0 0 28px;">
            <p style="color:#FFD700;font-size:14px;font-weight:700;margin:0 0 4px;">⏰ שים לב!</p>
            <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">הקבצים יישמרו במערכת <strong style="color:#fff;">ל-3 חודשים בלבד</strong>. אנא הורד אותם בהקדם.</p>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:28px 0 32px;">
            <a href="${galleryUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#D4AF37);color:#000;font-size:17px;font-weight:900;padding:18px 52px;border-radius:14px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,215,0,0.3);">
              📁 כניסה לגלריה שלי
            </a>
          </div>

          <!-- Steps -->
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <p style="color:#FFD700;font-size:14px;font-weight:700;margin:0 0 12px;">🚀 איך מורידים?</p>
            <div style="color:#aaa;font-size:13px;line-height:1.8;">
              <div>1. לחץ על הכפתור למעלה</div>
              <div>2. היכנס עם כתובת המייל שלך</div>
              <div>3. בחר את הקבצים ולחץ הורד</div>
            </div>
          </div>

          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0 20px;">
          <p style="color:#555;font-size:11px;margin:0;text-align:center;line-height:1.8;">
            הודעה אוטומטית מ-KLIKLY · לא להשיב למייל זה<br>
            אם אינך רוצה לקבל הודעות מסוג זה, <a href="${appUrl}/unsubscribe" style="color:#888;text-decoration:underline;">לחץ כאן להסרה מרשימת התפוצה</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0a0a0a;padding:20px 40px;text-align:center;border-top:1px solid #2a2a2a;">
          <div style="color:#FFD700;font-size:16px;font-weight:900;letter-spacing:3px;">KLIKLY</div>
          <div style="color:#444;font-size:11px;margin-top:4px;">© 2024 Klikly. כל הזכויות שמורות.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      console.log(`Sending email to: ${client_email}`);
      const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
        to: client_email,
        from_name: photographerName,
        subject: `📸 ${fileCountText} זמינים לפרויקט שלך`,
        body: emailHtml,
      });
      console.log('Email sent successfully:', JSON.stringify(emailResult));
    } catch (e) {
      console.error('Email send failed:', e.message, e.stack);
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