import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends automated follow-ups (email / whatsapp link) for leads whose
// auto_followup_next_send time has arrived.
// Triggered by a scheduled automation (every hour).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const nowIso = new Date().toISOString();

    // Get all leads with auto follow-up enabled and due for sending
    const allLeads = await base44.asServiceRole.entities.Lead.filter({
      auto_followup_enabled: true,
    }, '-updated_date', 500);

    const dueLeads = allLeads.filter((l) => {
      if (!l.auto_followup_next_send) return false;
      if ((l.auto_followup_attempts_sent || 0) >= (l.auto_followup_max_attempts || 3)) return false;
      return l.auto_followup_next_send <= nowIso;
    });

    let sentCount = 0;
    const results = [];

    for (const lead of dueLeads) {
      const channel = lead.auto_followup_channel || 'whatsapp';
      const message = lead.auto_followup_message ||
        `היי ${lead.name}, רציתי לבדוק אם קיבלת את הפרטים. אשמח לענות על כל שאלה.`;

      let emailSent = false;
      let waLogged = false;

      // Send email
      if ((channel === 'email' || channel === 'both') && lead.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: lead.email,
            subject: 'בקשר לפנייה שלך',
            body: message.replace(/\n/g, '<br/>'),
          });
          emailSent = true;
        } catch (e) {
          console.error('email send failed', e);
        }
      }

      // Log a WhatsApp activity (we cannot send WA programmatically without
      // a paid provider — but we record an activity & timestamp so the
      // photographer knows to send manually, and the link is available).
      if (channel === 'whatsapp' || channel === 'both') {
        try {
          const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
          const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
          const waLink = `https://wa.me/${israelPhone}?text=${encodeURIComponent(message)}`;

          await base44.asServiceRole.entities.Activity.create({
            related_to_type: 'lead',
            related_to_id: lead.id,
            activity_type: 'email_sent',
            title: 'פולו-אפ אוטומטי – וואטסאפ מוכן לשליחה',
            description: message,
            metadata: { waLink, channel: 'whatsapp', auto: true },
          });

          // Also email the photographer the WA link so they can click & send
          if (lead.created_by) {
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: lead.created_by,
                subject: `📲 פולו-אפ אוטומטי מוכן לשליחה – ${lead.name}`,
                body: `הגיע הזמן לשלוח פולו-אפ ל-${lead.name} (${lead.phone}).<br/><br/><a href="${waLink}" style="display:inline-block;padding:12px 24px;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">שלח בוואטסאפ עכשיו</a><br/><br/>תוכן ההודעה:<br/><i>${message}</i>`,
              });
            } catch (e) {
              console.error('photographer notify failed', e);
            }
          }
          waLogged = true;
        } catch (e) {
          console.error('wa log failed', e);
        }
      }

      if (emailSent || waLogged) {
        const attempts = (lead.auto_followup_attempts_sent || 0) + 1;
        const maxAttempts = lead.auto_followup_max_attempts || 3;
        const intervalDays = lead.auto_followup_interval_days || 3;
        const reachedMax = attempts >= maxAttempts;

        const nextSend = (() => {
          if (reachedMax) return null;
          const sendTime = lead.auto_followup_send_time || '10:00';
          const sendDay = lead.auto_followup_send_day || 'any';
          const [hours, minutes] = sendTime.split(':').map(Number);
          const next = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
          next.setHours(hours || 10, minutes || 0, 0, 0);
          if (sendDay !== 'any') {
            const targetDay = Number(sendDay);
            while (next.getDay() !== targetDay) {
              next.setDate(next.getDate() + 1);
            }
          }
          return next.toISOString();
        })();

        await base44.asServiceRole.entities.Lead.update(lead.id, {
          auto_followup_attempts_sent: attempts,
          auto_followup_last_sent: nowIso,
          auto_followup_next_send: nextSend,
          auto_followup_enabled: !reachedMax,
          last_contact_date: nowIso,
        });

        // Activity log for email (if sent)
        if (emailSent) {
          await base44.asServiceRole.entities.Activity.create({
            related_to_type: 'lead',
            related_to_id: lead.id,
            activity_type: 'email_sent',
            title: `פולו-אפ אוטומטי במייל (#${attempts})`,
            description: message,
            metadata: { auto: true, channel: 'email' },
          });
        }

        if (lead.auto_followup_push_enabled !== false && lead.created_by) {
          try {
            await base44.asServiceRole.functions.invoke('sendPushNotification', {
              target_email: lead.created_by,
              title: 'פולו־אפ נשלח',
              body: `${lead.name || 'ליד'} · ${channel === 'both' ? 'וואטסאפ + מייל' : channel}`,
              url: `/LeadDetails?id=${lead.id}`,
            });
          } catch (e) {
            console.error('push notify failed', e);
          }
        }

        sentCount++;
        results.push({ id: lead.id, name: lead.name, attempts, channel, emailSent, waLogged });
      }
    }

    return Response.json({
      ok: true,
      total_due: dueLeads.length,
      sent: sentCount,
      results,
    });
  } catch (error) {
    console.error('runAutoFollowUps error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});