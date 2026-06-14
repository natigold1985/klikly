import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Client-facing endpoint to view and manage their OWN newsletter subscription
// and important dates (birthday). Acts on the authenticated user's email only.
// action: "get" | "subscribe" | "unsubscribe" | "update_birthday"
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = String(user.email || '').toLowerCase().trim();
    if (!email) return Response.json({ error: 'No email on user' }, { status: 400 });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || 'get';

    const svc = base44.asServiceRole.entities;

    // Helper: find this client's subscriber record
    const findSubscriber = async () => {
      const list = await svc.NewsletterSubscriber.filter({ email });
      return list[0] || null;
    };

    // Helper: find this client's contact record (for birthday)
    const findContact = async () => {
      const byEmail = await svc.Contact.filter({ email });
      return byEmail[0] || null;
    };

    if (action === 'subscribe') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const existing = await findSubscriber();
      if (existing) {
        await svc.NewsletterSubscriber.update(existing.id, {
          status: 'active',
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          consent_ip: ip,
          consent_text: 'אני מאשר/ת קבלת דיוור ועדכונים',
          full_name: body.full_name || existing.full_name || user.full_name,
        });
      } else {
        await svc.NewsletterSubscriber.create({
          email,
          full_name: body.full_name || user.full_name || '',
          source: 'client_existing',
          interests: [],
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          consent_ip: ip,
          consent_text: 'אני מאשר/ת קבלת דיוור ועדכונים',
          status: 'active',
          unsubscribe_token: crypto.randomUUID(),
        });
      }
    } else if (action === 'unsubscribe') {
      const existing = await findSubscriber();
      if (existing) {
        await svc.NewsletterSubscriber.update(existing.id, {
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
        });
      }
    } else if (action === 'update_birthday') {
      const birthday = body.birthday || null; // YYYY-MM-DD or null
      const consent = body.birthday_greeting_consent === true;
      const contact = await findContact();
      if (contact) {
        await svc.Contact.update(contact.id, {
          birthday,
          birthday_greeting_consent: consent,
        });
      } else {
        await svc.Contact.create({
          name: user.full_name || email,
          phone: body.phone || '—',
          email,
          type: 'client',
          birthday,
          birthday_greeting_consent: consent,
        });
      }
    }

    // Always return the current state
    const [subscriber, contact] = await Promise.all([findSubscriber(), findContact()]);

    return Response.json({
      email,
      full_name: user.full_name || subscriber?.full_name || '',
      subscribed: subscriber?.status === 'active',
      birthday: contact?.birthday || null,
      birthday_greeting_consent: contact?.birthday_greeting_consent === true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});