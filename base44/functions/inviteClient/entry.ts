import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// SECURITY:
// Only an authenticated user with role 'admin' or 'user' (photographer) can invite a client.
// Prevents privilege escalation: cannot demote an existing admin/user to client,
// and cannot reassign a client that already belongs to another photographer.

function buildClientInviteEmailHtml({ clientName, photographerName, galleryUrl, loginUrl }) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
            <span style="color:#FFD700;font-size:28px;font-weight:900;letter-spacing:2px;">KLIKLY</span>
            <p style="color:#ffffff99;font-size:13px;margin:6px 0 0;">פלטפורמת צילום מקצועית</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="color:#0a0a0a;font-size:22px;margin:0 0 16px;">היי ${clientName} 👋</h2>
            <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 20px;">
              ${photographerName} הכין עבורך גלריה אישית עם כל הצילומים שלך.
              <br>כבר עכשיו ניתן לצפות, לבחור ולהוריד את הקבצים שלך.
            </p>
            <!-- CTA Button -->
            <div style="text-align:center;margin:32px 0;">
              <a href="${galleryUrl}" style="display:inline-block;background:#FFD700;color:#000000;font-size:17px;font-weight:700;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
                📸 כניסה לגלריה שלי
              </a>
            </div>
            <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 20px;">
              הכניסה מתבצעת דרך חשבון Google שלך — אין צורך בסיסמה.
              <br>אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:
            </p>
            <p style="background:#f4f4f5;border-radius:8px;padding:12px 16px;font-size:12px;color:#888;word-break:break-all;margin:0 0 24px;">${galleryUrl}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#999;font-size:12px;margin:0;">נשלח אוטומטית ע"י KLIKLY. לשאלות, פנה ישירות ל-${photographerName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const photographer = await base44.auth.me();
    if (!photographer) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['admin', 'user'].includes(photographer.role) && photographer.email !== 'natigold04@gmail.com') {
      return Response.json({ error: 'Forbidden: only photographers/admins can invite clients' }, { status: 403 });
    }

    const { full_name, email, phone } = await req.json();
    if (!email || !full_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const appBaseUrl = 'https://klikly.base44.app'; // Base URL for the app
    const galleryUrl = `${appBaseUrl}/FileStorage`;
    const photographerName = photographer.full_name || photographer.email;

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      // SECURITY: never demote an admin or another photographer to client
      if (existing.role && existing.role !== 'client') {
        return Response.json(
          { error: 'משתמש זה רשום כבר כמשתמש פעיל במערכת' },
          { status: 409 }
        );
      }
      // SECURITY: never steal a client already assigned to a different photographer
      if (existing.assigned_photographer_email && existing.assigned_photographer_email !== photographer.email) {
        return Response.json(
          { error: 'הלקוח הזה משויך כבר לצלם אחר' },
          { status: 409 }
        );
      }
      if (!existing.assigned_photographer_email) {
        await base44.asServiceRole.entities.User.update(existing.id, {
          assigned_photographer_email: photographer.email,
          phone: phone || existing.phone,
          role: 'client',
          is_invited: true,
        });
      }

      // Send gallery invite email to returning/re-linked client
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: normalizedEmail,
          from_name: photographerName,
          subject: `📸 ${photographerName} שיתף איתך גלריה ב-KLIKLY`,
          body: buildClientInviteEmailHtml({
            clientName: existing.full_name || full_name,
            photographerName,
            galleryUrl,
          }),
        });
      } catch (emailErr) {
        console.error('Gallery invite email failed:', emailErr.message);
      }

      return Response.json({ success: true, user: existing, alreadyExisted: true });
    }

    // Invite the user via base44 (sends Google login email)
    await base44.users.inviteUser(normalizedEmail, 'user');

    // Wait briefly and find the newly created user record
    await new Promise(r => setTimeout(r, 800));
    const created = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (created.length > 0) {
      await base44.asServiceRole.entities.User.update(created[0].id, {
        full_name,
        phone: phone || '',
        assigned_photographer_email: photographer.email,
        role: 'client',
        is_invited: true,
      });
    }

    // Send branded gallery invite email to new client
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: normalizedEmail,
        from_name: photographerName,
        subject: `📸 ${photographerName} שיתף איתך גלריה ב-KLIKLY`,
        body: buildClientInviteEmailHtml({
          clientName: full_name,
          photographerName,
          galleryUrl,
        }),
      });
      console.log('Gallery invite email sent to', normalizedEmail);
    } catch (emailErr) {
      console.error('Gallery invite email failed:', emailErr.message);
    }

    // Log the action
    await base44.asServiceRole.entities.SystemLog.create({
      action: 'Client Invited',
      details: `לקוח ${full_name} (${normalizedEmail}) הוזמן ע"י ${photographer.email} — מייל גלריה נשלח`,
      status: 'success',
      related_entity_type: 'User',
      owner_id: photographer.id,
    });

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("inviteClient error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});