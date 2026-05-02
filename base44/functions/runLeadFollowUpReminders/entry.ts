import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends a reminder email to the photographer for leads created X days ago
// that haven't been closed yet.
// Triggered by a scheduled automation (daily at 09:00 photographer time).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const nowIso = new Date().toISOString();

    // Get all photographer settings (one per photographer)
    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 500);
    const enabledSettings = allSettings.filter((s) => s.lead_followup_enabled !== false);

    let totalNotified = 0;
    const summary = [];

    for (const settings of enabledSettings) {
      const photographerEmail = settings.created_by;
      if (!photographerEmail) continue;

      const days = settings.lead_followup_days || 3;
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();

      // Get all leads owned by this photographer that are still open
      const allLeads = await base44.asServiceRole.entities.Lead.filter(
        { created_by: photographerEmail },
        '-created_date',
        500
      );

      const staleLeads = allLeads.filter((l) => {
        if (['closed_won', 'closed_lost'].includes(l.status)) return false;
        if (!l.created_date) return false;
        return l.created_date <= cutoffIso;
        // Note: we don't check last reminder time, since the schedule is daily
        // and only matches leads >= X days old. Photographer can dismiss leads.
      });

      if (staleLeads.length === 0) continue;

      // Build a reminder email
      const leadsHtml = staleLeads.slice(0, 20).map((l) => {
        const ageDays = Math.floor((Date.now() - new Date(l.created_date).getTime()) / (1000 * 60 * 60 * 24));
        const cleanPhone = (l.phone || '').replace(/[^0-9]/g, '');
        const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const waLink = `https://wa.me/${israelPhone}`;
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee">
              <strong>${l.name || 'ללא שם'}</strong><br/>
              <span style="color:#888;font-size:12px">${l.phone || ''} ${l.shooting_type ? '• ' + l.shooting_type : ''}</span><br/>
              <span style="color:#c0392b;font-size:11px">פתוח כבר ${ageDays} ימים</span>
              ${l.phone ? `&nbsp;•&nbsp;<a href="${waLink}" style="color:#25D366;text-decoration:none;font-size:12px">WhatsApp</a>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      const moreCount = staleLeads.length > 20 ? `<p style="color:#888;font-size:12px;margin-top:8px">ועוד ${staleLeads.length - 20} לידים...</p>` : '';

      const body = `
        <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;max-width:600px">
          <h2 style="color:#D4AF37">📋 תזכורת: ${staleLeads.length} לידים פתוחים מעל ${days} ימים</h2>
          <p>היי ${settings.business_name || ''},<br/>
          הנה רשימת הלידים שטרם נסגרו והם פתוחים יותר מ-${days} ימים. שווה לחזור אליהם:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            ${leadsHtml}
          </table>
          ${moreCount}
          <p style="margin-top:24px">
            <a href="${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/Leads" 
               style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#000;text-decoration:none;border-radius:8px;font-weight:bold">
              פתח את לוח הלידים →
            </a>
          </p>
          <p style="color:#999;font-size:11px;margin-top:24px">
            אפשר לכבות תזכורות אלו בהגדרות → תזכורות אוטומטיות.
          </p>
        </div>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: photographerEmail,
          subject: `🔔 ${staleLeads.length} לידים מחכים לטיפול`,
          body,
        });
        totalNotified++;
        summary.push({ photographer: photographerEmail, leads: staleLeads.length });
      } catch (e) {
        console.error('email failed for', photographerEmail, e);
      }
    }

    return Response.json({ ok: true, photographers_notified: totalNotified, summary });
  } catch (error) {
    console.error('runLeadFollowUpReminders error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});