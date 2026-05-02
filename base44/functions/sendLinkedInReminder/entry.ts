// Twice-daily LinkedIn lead-hunting reminder.
// Triggered by a scheduled automation (09:00 & 15:00 Asia/Jerusalem).
// Sends an email with pre-built LinkedIn search links to the photographer/admin,
// who manually copies search results back into the LeadImport "LinkedIn → Paste & Extract" flow.
//
// No Gmail/LLM/web-search calls here — minimal credit usage (just SendEmail).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LINKEDIN_SEARCHES = [
  {
    label: 'משרד הביטחון — אנשי קשר רלוונטיים',
    url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%9E%D7%A9%D7%A8%D7%93%20%D7%94%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  },
  {
    label: 'משרד הביטחון — דובר/יח״צ/תקשורת',
    url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%93%D7%95%D7%91%D7%A8%20%D7%9E%D7%A9%D7%A8%D7%93%20%D7%94%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  },
  {
    label: 'מפיקי אירועים — חברות ביטחוניות',
    url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%9E%D7%A4%D7%99%D7%A7%20%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99%D7%9D%20%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  },
  {
    label: 'פוסטים אחרונים: "דרוש צלם"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22%D7%93%D7%A8%D7%95%D7%A9%20%D7%A6%D7%9C%D7%9D%22',
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find the admin (the photographer running this app).
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const target = admins[0] || { email: 'natigold04@gmail.com', full_name: 'בעל העסק' };

    const linksHtml = LINKEDIN_SEARCHES.map(s => `
      <li style="margin-bottom:10px;">
        <a href="${s.url}" target="_blank" style="color:#0A66C2;font-weight:bold;text-decoration:none;">
          🔗 ${s.label}
        </a>
      </li>
    `).join('');

    const body = `
      <div dir="rtl" style="font-family:Rubik,Arial,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <div style="background:#0A66C2;color:#fff;padding:16px;border-radius:12px;margin-bottom:20px;text-align:center;">
            <h2 style="margin:0;font-size:20px;">🎯 תזכורת לידים מ-LinkedIn</h2>
          </div>
          <p style="color:#334155;font-size:15px;line-height:1.6;">
            היי ${target.full_name || 'צלם יקר'},<br/>
            הגיע הזמן לסריקת לידים ב-LinkedIn. לחץ על כל קישור, סמן את התוצאות הרלוונטיות, העתק והדבק ב-<b>ייבוא לידים → LinkedIn</b>.
          </p>
          <ul style="list-style:none;padding:0;margin:20px 0;">
            ${linksHtml}
          </ul>
          <div style="background:#FFFBEA;border:1px solid #FFD700;border-radius:10px;padding:12px;font-size:13px;color:#78350F;">
            💡 טיפ: ה-AI יחלץ אוטומטית שמות, תפקידים וחברות מהטקסט שתדביק.
          </div>
        </div>
      </div>
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: target.email,
      subject: '🎯 תזכורת LinkedIn — חיפוש לידים מוכן',
      body,
    });

    return Response.json({ success: true, sent_to: target.email });
  } catch (error) {
    console.error('sendLinkedInReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});