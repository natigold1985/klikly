import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint accessed via unsubscribe link in emails.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('חסר טוקן הסרה', { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.NewsletterSubscriber.filter({
      unsubscribe_token: token
    });

    if (matches.length === 0) {
      return new Response('הקישור אינו תקף', { status: 404 });
    }

    await base44.asServiceRole.entities.NewsletterSubscriber.update(matches[0].id, {
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString()
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>הוסרת מהרשימה</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; text-align: center; }
          .card { max-width: 480px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          h1 { color: #0f172a; }
          p { color: #475569; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ הוסרת בהצלחה</h1>
          <p>הוסרת מרשימת התפוצה שלנו.<br/>לא תקבל/י עוד הודעות שיווקיות.</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">אם זו הייתה טעות, ניתן להירשם מחדש דרך האתר.</p>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    return new Response(`שגיאה: ${error.message}`, { status: 500 });
  }
});