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

      for (const lead of staleLeads) {
        const body = `
          <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;max-width:600px">
            <h2 style="color:#D4AF37">היי ${lead.name || ''}, מה קורה?</h2>
            <p>פנית אלי לפני כמה ימים${lead.shooting_type ? ` בנושא ${lead.shooting_type}` : ''} ורציתי לוודא שהפנייה שלך לא נפלה בין הכיסאות 🙂</p>
            <p>אם יש שאלות, אשמח לענות — פשוט תגיב/י למייל הזה או תתקשר/י.</p>
            <p style="margin-top:20px;color:#666">בברכה,<br/><strong>${businessName}</strong>${settings.phone ? '<br/>' + settings.phone : ''}</p>
          </div>
        `;

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