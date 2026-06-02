import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function firstName(name = '') {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function personalize(text = '', subscriber) {
  return String(text || '')
    .replaceAll('{{שם}}', firstName(subscriber.full_name))
    .replaceAll('{{שם מלא}}', subscriber.full_name || '')
    .replaceAll('{{אימייל}}', subscriber.email || '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.email !== 'natigold04@gmail.com') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const dryRun = payload.dryRun === true;

    if (!subject || !body) {
      return Response.json({ error: 'Missing subject or body' }, { status: 400 });
    }

    const settings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 50);
    const businessName = settings[0]?.business_name || 'KLIKLY';
    const subscribers = await base44.asServiceRole.entities.NewsletterSubscriber.list('-created_date', 1000);
    const recipients = subscribers.filter((subscriber) => {
      return subscriber.status === 'active' &&
        subscriber.consent_given === true &&
        !!subscriber.consent_timestamp &&
        !!subscriber.consent_text &&
        subscriber.email;
    });

    if (dryRun) {
      return Response.json({ success: true, dryRun: true, recipients: recipients.length });
    }

    let sent = 0;
    const errors = [];
    const nowIso = new Date().toISOString();

    for (const subscriber of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: businessName,
          to: subscriber.email,
          subject: personalize(subject, subscriber),
          body: personalize(body, subscriber),
        });

        await base44.asServiceRole.entities.NewsletterSubscriber.update(subscriber.id, {
          last_email_sent: nowIso,
        });
        sent++;
      } catch (error) {
        errors.push({ email: subscriber.email, error: error.message });
      }
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'Newsletter broadcast sent',
      details: `Sent ${sent} newsletter emails. Errors: ${errors.length}`,
      status: errors.length ? 'pending' : 'success',
      related_entity_type: 'NewsletterSubscriber',
      owner_id: user.email,
    });

    return Response.json({ success: true, sent, recipients: recipients.length, errors });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});