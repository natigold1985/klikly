import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint — no auth required.
// Records explicit consent (anti-spam law compliance).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      email,
      full_name,
      phone,
      consent_given,
      consent_text,
      interests,
      source = 'course_landing'
    } = body;

    if (!email || !consent_given) {
      return Response.json(
        { error: 'נדרש אימייל ואישור הסכמה לדיוור' },
        { status: 400 }
      );
    }

    // Capture client IP for legal record
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';

    // Check for existing subscriber (avoid duplicates)
    const existing = await base44.asServiceRole.entities.NewsletterSubscriber.filter({
      email: email.toLowerCase().trim()
    });

    const unsubscribe_token = crypto.randomUUID();

    if (existing.length > 0) {
      // Re-activate if previously unsubscribed
      await base44.asServiceRole.entities.NewsletterSubscriber.update(existing[0].id, {
        status: 'active',
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        consent_ip: ip,
        consent_text: consent_text || 'אני מאשר/ת קבלת דיוור שיווקי',
        full_name: full_name || existing[0].full_name,
        phone: phone || existing[0].phone,
        interests: interests || existing[0].interests
      });
      return Response.json({ success: true, message: 'נרשמת בהצלחה!' });
    }

    await base44.asServiceRole.entities.NewsletterSubscriber.create({
      email: email.toLowerCase().trim(),
      full_name,
      phone,
      source,
      interests: interests || [],
      consent_given: true,
      consent_timestamp: new Date().toISOString(),
      consent_ip: ip,
      consent_text: consent_text || 'אני מאשר/ת קבלת דיוור שיווקי',
      status: 'active',
      unsubscribe_token
    });

    return Response.json({ success: true, message: 'נרשמת בהצלחה לרשימת התפוצה!' });
  } catch (error) {
    console.error('subscribeNewsletter error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});