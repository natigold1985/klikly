import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const photographer = await base44.auth.me();
    if (!photographer) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, email, phone } = await req.json();
    if (!email || !full_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const appUrl = 'https://klikly.base44.app';
    const galleryUrl = `${appUrl}/FileStorage`;

    // Check if already exists in TeamMember
    const existing = await base44.asServiceRole.entities.TeamMember.filter({ email: normalizedEmail });
    if (existing.length > 0) {
      const m = existing[0];
      if (!m.assigned_photographer_email) {
        await base44.asServiceRole.entities.TeamMember.update(m.id, {
          assigned_photographer_email: photographer.email,
          phone: phone || m.phone,
          role: 'client',
          is_active: true,
        });
      }
    } else {
      // Create TeamMember record
      await base44.asServiceRole.entities.TeamMember.create({
        email: normalizedEmail,
        full_name,
        phone: phone || '',
        role: 'client',
        assigned_photographer_email: photographer.email,
        is_active: true,
      });
    }

    // Invite user to the platform (sends platform login invitation)
    try {
      await base44.asServiceRole.users.inviteUser(normalizedEmail, 'client');
    } catch (inviteErr) {
      // User may already be registered — not a fatal error
      console.log('inviteUser note:', inviteErr.message);
    }

    // Send branded gallery invitation email
    const photographerName = photographer.full_name || photographer.email;
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      from_name: 'KLIKLY',
      subject: `📸 ${photographerName} שיתף איתך גלריה ב-KLIKLY`,
      body: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center;">
          <span style="color:#FFD700;font-size:28px;font-weight:900;letter-spacing:3px;">KLIKLY</span>
        </td></tr>
        <tr><td style="padding:40px 40px 28px;">
          <h2 style="color:#0a0a0a;font-size:22px;margin:0 0 12px;">שלום ${full_name}! 👋</h2>
          <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 8px;">
            <strong>${photographerName}</strong> הוסיף אותך למערכת KLIKLY.
          </p>
          <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 24px;">
            דרך המערכת תוכל לצפות ולהוריד את הצילומים שלך בקלות ובנוחות.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${galleryUrl}" style="display:inline-block;background:#FFD700;color:#000;font-size:16px;font-weight:700;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
              📁 כניסה לגלריה שלי
            </a>
          </div>
          <div style="background:#f9f9f9;border-radius:10px;padding:16px 20px;margin:20px 0;">
            <p style="color:#666;font-size:14px;margin:0 0 6px;font-weight:600;">איך נכנסים?</p>
            <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
              1. לחץ על הכפתור למעלה<br>
              2. הכנס עם כתובת המייל שלך: <strong>${normalizedEmail}</strong><br>
              3. תקבל קוד כניסה חד-פעמי למייל שלך
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
          <p style="color:#999;font-size:12px;margin:0;text-align:center;">הודעה אוטומטית מ-KLIKLY · מערכת ניהול גלריות מקצועית</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("inviteClient error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});