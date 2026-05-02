import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends an automated follow-up email to clients who received a quote
// but haven't responded (status still 'sent' or 'viewed') for X days.
// Triggered by a scheduled automation (daily).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const nowIso = new Date().toISOString();

    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 500);
    const enabledSettings = allSettings.filter((s) => s.quote_followup_enabled !== false);

    let totalSent = 0;
    const summary = [];

    for (const settings of enabledSettings) {
      const photographerEmail = settings.created_by;
      if (!photographerEmail) continue;

      const days = settings.quote_followup_days || 2;
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();

      // Get all quotes owned by this photographer that are sent or viewed
      const allQuotes = await base44.asServiceRole.entities.Quote.filter(
        { created_by: photographerEmail },
        '-created_date',
        500
      );

      const pendingQuotes = allQuotes.filter((q) => {
        if (!['sent', 'viewed'].includes(q.status)) return false;
        if (!q.client_email) return false;
        // Use updated_date as the "sent date" — when status changed to sent
        const refDate = q.updated_date || q.created_date;
        if (!refDate || refDate > cutoffIso) return false;
        // Don't send twice — guard via a marker in description (simple flag)
        // Better: check if a recent activity already exists for this quote
        return true;
      });

      for (const q of pendingQuotes) {
        // Check if we already sent a follow-up in the last 5 days (to avoid spam)
        const recentActivities = await base44.asServiceRole.entities.Activity.filter({
          related_to_type: 'quote',
          related_to_id: q.id,
          activity_type: 'email_sent',
        });
        const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
        const alreadySent = recentActivities.some((a) => {
          if (!a.metadata?.auto_followup) return false;
          return new Date(a.created_date).getTime() > fiveDaysAgo;
        });
        if (alreadySent) continue;

        const link = q.access_token
          ? `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/quote/view?token=${q.access_token}`
          : null;

        const businessName = settings.business_name || 'הצלם';
        const itemsList = (q.items || []).map((i) =>
          `• ${i.description} — ₪${(i.price || 0) * (i.quantity || 1)}`
        ).join('<br/>');

        const body = `
          <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;max-width:600px">
            <h2 style="color:#D4AF37">היי ${q.client_name},</h2>
            <p>רציתי לבדוק אם הספקת לעיין בהצעת המחיר ששלחתי לך${q.package_name ? ` עבור <strong>${q.package_name}</strong>` : ''}.</p>
            ${itemsList ? `<div style="background:#fafafa;border:1px solid #eee;padding:14px;border-radius:8px;font-size:13px">${itemsList}</div>` : ''}
            <p style="margin-top:14px"><strong>סה"כ: ₪${(q.total_price || 0).toLocaleString()}</strong></p>
            ${link ? `
              <p style="margin-top:24px">
                <a href="${link}" 
                   style="display:inline-block;padding:14px 28px;background:#D4AF37;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">
                  לצפייה ואישור ההצעה →
                </a>
              </p>
            ` : ''}
            <p style="margin-top:20px">אשמח לענות על כל שאלה — פשוט תגיב/י למייל הזה.</p>
            <p style="color:#666">בברכה,<br/>${businessName}</p>
          </div>
        `;

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: businessName,
            to: q.client_email,
            subject: `תזכורת: הצעת המחיר${q.package_name ? ` ל-${q.package_name}` : ''}`,
            body,
          });

          // Log activity
          await base44.asServiceRole.entities.Activity.create({
            related_to_type: 'quote',
            related_to_id: q.id,
            activity_type: 'email_sent',
            title: 'פולואפ אוטומטי ללקוח על הצעת מחיר',
            description: `נשלח מייל פולואפ ל-${q.client_email} (${days} ימים אחרי שליחת ההצעה)`,
            metadata: { auto_followup: true, days_since_sent: days },
          });

          totalSent++;
          summary.push({ photographer: photographerEmail, client: q.client_email, quote_id: q.id });
        } catch (e) {
          console.error('quote followup failed', q.id, e);
        }
      }
    }

    return Response.json({ ok: true, total_sent: totalSent, summary });
  } catch (error) {
    console.error('runQuoteFollowUps error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});