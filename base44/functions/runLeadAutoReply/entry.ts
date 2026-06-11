import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends an automatic follow-up email "היי מה קורה?" to leads that haven't
// been closed AND haven't been contacted (no last_contact_date) for X days.
// Triggered by a scheduled automation (daily).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const nowIso = new Date().toISOString();

    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 500);
    const enabledSettings = allSettings.filter((s) => s.lead_auto_reply_enabled !== false);

    let totalSent = 0;
    const summary = [];

    for (const settings of enabledSettings) {
      const photographerEmail = settings.created_by;
      if (!photographerEmail) continue;

      const days = settings.lead_auto_reply_days || 3;
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();

      const allLeads = await base44.asServiceRole.entities.Lead.filter(
        { created_by: photographerEmail },
        '-created_date',
        500
      );

      const staleLeads = allLeads.filter((l) => {
        if (['closed_won', 'closed_lost'].includes(l.status)) return false;
        if (!l.email) return false;
        if (l.lead_auto_reply_sent) return false;
        if (!l.created_date) return false;
        return l.created_date <= cutoffIso;
      });

      const businessName = settings.business_name || 'הצלם';
      const appUrl = 'https://app.klikly.com';

      for (const lead of staleLeads) {
        const shootingContext = lead.shooting_type ? ` בנושא <strong style="color:#fff;">${lead.shooting_type}</strong>` : '';
        const body = `<!DOCTYPE html>
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

        <!-- Hero -->
        <tr><td style="background:linear-gradient(135deg,#FFD700 0%,#D4AF37 100%);padding:24px 40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:6px;">👋</div>
          <h1 style="color:#000;font-size:22px;font-weight:900;margin:0;">היי ${lead.name || ''}, מה קורה?</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 28px;">
          <p style="color:#aaaaaa;font-size:16px;line-height:1.8;margin:0 0 16px;">
            פנית אלינו לפני כמה ימים${shootingContext} ורצינו לוודא שהפנייה שלך לא נפלה בין הכיסאות 🙂
          </p>
          <p style="color:#aaaaaa;font-size:16px;line-height:1.8;margin:0 0 28px;">
            אם יש לך שאלות, נשמח לענות — פשוט הגב/י למייל הזה או צור/י קשר ישירות.
          </p>

          <!-- Signature -->
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-right:4px solid #FFD700;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#FFD700;font-size:15px;font-weight:700;margin:0 0 4px;">${businessName}</p>
            ${settings.phone ? `<p style="color:#aaa;font-size:13px;margin:0;">📞 ${settings.phone}</p>` : ''}
            ${settings.email ? `<p style="color:#aaa;font-size:13px;margin:4px 0 0;">✉️ ${settings.email}</p>` : ''}
          </div>

          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0 20px;">
          <p style="color:#555;font-size:11px;margin:0;text-align:center;line-height:1.8;">
            הודעה אוטומטית מ-KLIKLY · לא להשיב ישירות למייל זה<br>
            קיבלת מייל זה מכיוון שמילאת טופס פנייה. לביטול קבלת הודעות עתידיות,
            <a href="${appUrl}/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color:#888;text-decoration:underline;">לחץ כאן להסרה מרשימת התפוצה</a>.
            פעולה זו תבטל שליחת הודעות אוטומטיות בלבד.
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

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: businessName,
            to: lead.email,
            subject: `היי ${lead.name || ''}, מה קורה?`,
            body,
          });

          await base44.asServiceRole.entities.Lead.update(lead.id, {
            lead_auto_reply_sent: true,
            last_contact_date: nowIso,
          });

          await base44.asServiceRole.entities.Activity.create({
            related_to_type: 'lead',
            related_to_id: lead.id,
            activity_type: 'email_sent',
            title: 'פולואפ אוטומטי ללקוח (היי מה קורה?)',
            description: `נשלח מייל אוטומטי ל-${lead.email} (${days} ימים אחרי יצירת הליד)`,
            metadata: { auto_reply: true, days_since_created: days },
          });

          totalSent++;
          summary.push({ photographer: photographerEmail, lead: lead.id, email: lead.email });
        } catch (e) {
          console.error('lead auto-reply failed', lead.id, e);
        }
      }
    }

    return Response.json({ ok: true, total_sent: totalSent, summary });
  } catch (error) {
    console.error('runLeadAutoReply error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});