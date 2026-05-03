// Lead Radar — discovers potential leads from Gmail (forwarded posts, group emails, alerts)
// using deterministic keyword matching. NO LLM credits used.
// If users want web-radar features, those should be added via Gmail alerts/Google Alerts forwarded
// to the connected mailbox.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KEYWORDS = [
  'דרוש צלם', 'דרושה צלמת', 'מחפש צלם', 'מחפשת צלם', 'מחפשים צלם',
  'photographer needed', 'looking for a photographer', 'hiring photographer',
  'need a photographer', 'event photographer',
  'צלם לאירוע', 'צלם לחתונה', 'צלם לבר מצווה', 'צלם לבת מצווה',
  'צלם וידאו', 'צלמת אירועים', 'צלם מקצועי',
  'מכרז צילום', 'הצעת מחיר צילום', 'שירותי צילום',
  'wedding photographer', 'bar mitzvah photographer', 'corporate photographer',
];

function pickKeywords(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter(k => lower.includes(k.toLowerCase()));
}

function extractContact(text) {
  const phone = (text.match(/(?:\+?972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/) || [])[0] || '';
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  return { phone, email };
}

function platformFromSubjectAndFrom(subject = '', from = '') {
  const s = (subject + ' ' + from).toLowerCase();
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('facebook') || s.includes('פייסבוק')) return 'facebook';
  if (s.includes('instagram') || s.includes('אינסטגרם')) return 'instagram';
  if (s.includes('forum') || s.includes('פורום')) return 'forum';
  if (s.includes('jobs') || s.includes('דרושים')) return 'job_board';
  return 'other';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Find emails that look like leads (Google Alerts, LinkedIn notifications, group forwards)
    const queries = [
      'newer_than:14d (subject:"Google Alert" OR from:googlealerts-noreply@google.com)',
      'newer_than:14d ("דרוש צלם" OR "מחפש צלם" OR "מחפשת צלמת" OR "photographer needed")',
      // LinkedIn-specific: notifications, jobs, posts mentioning photographer needs
      'newer_than:14d from:linkedin.com',
      'newer_than:14d (from:jobs-noreply@linkedin.com OR from:jobs-listings@linkedin.com OR from:notifications-noreply@linkedin.com)',
      'newer_than:14d (subject:"linkedin" AND ("photographer" OR "צלם" OR "videographer"))',
    ];

    const messageIds = new Set();
    for (const q of queries) {
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(q)}`,
        { headers: authHeader }
      );
      if (!listRes.ok) continue;
      const data = await listRes.json();
      (data.messages || []).forEach(m => messageIds.add(m.id));
    }

    if (messageIds.size === 0) {
      return Response.json({ success: true, found: 0, saved: 0, summary: 'אין תוצאות חדשות בתיבת המייל' });
    }

    const discovered = [];
    for (const id of Array.from(messageIds).slice(0, 25)) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const msg = await res.json();
      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';

      let text = '';
      const walk = (p) => {
        if (!p) return;
        if (p.mimeType === 'text/plain' && p.body?.data) {
          try { text += atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/')) + '\n'; } catch {}
        }
        if (p.parts) p.parts.forEach(walk);
      };
      walk(msg.payload);

      const matched = pickKeywords(text);
      if (matched.length === 0) continue;

      // Find a representative line / link
      const linkMatch = text.match(/https?:\/\/[^\s)]+/);
      const sourceUrl = linkMatch ? linkMatch[0] : '';
      const { phone, email } = extractContact(text);

      // Use the first 200 chars of the matching paragraph as snippet
      const idx = text.toLowerCase().indexOf(matched[0].toLowerCase());
      const snippet = text.substring(Math.max(0, idx - 50), Math.min(text.length, idx + 200)).trim();

      const platform = platformFromSubjectAndFrom(subject, from);
      discovered.push({
        title: (subject || matched[0]).substring(0, 200),
        platform,
        snippet,
        source_url: sourceUrl,
        keywords_matched: matched.join(', '),
        // LinkedIn results get a small relevance boost since they're more targeted
        relevance_score: Math.min(10, (platform === 'linkedin' ? 5 : 4) + matched.length * 2),
        contact_info: [phone, email].filter(Boolean).join(' / ') || 'N/A',
      });
    }

    if (discovered.length === 0) {
      return Response.json({ success: true, found: 0, saved: 0, summary: 'לא נמצאו פוסטים רלוונטיים' });
    }

    // Dedup by title
    const existing = await base44.entities.PotentialLead.filter({}, '-created_date', 100);
    const existingTitles = new Set(existing.map(e => e.title?.toLowerCase().trim()));
    const newOnes = discovered.filter(l => l.title && !existingTitles.has(l.title.toLowerCase().trim()));

    if (newOnes.length > 0) {
      await base44.entities.PotentialLead.bulkCreate(newOnes.map(l => ({
        title: l.title.substring(0, 200),
        platform: l.platform,
        snippet: l.snippet?.substring(0, 500) || '',
        source_url: l.source_url,
        keywords_matched: l.keywords_matched,
        relevance_score: l.relevance_score,
        contact_info: l.contact_info,
        status: 'new',
      })));
    }

    return Response.json({
      success: true,
      found: discovered.length,
      saved: newOnes.length,
      summary: `סריקה הושלמה: ${discovered.length} פוסטים, ${newOnes.length} חדשים`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});