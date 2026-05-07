// Lead Radar — scans Gmail alerts/forwards and saves only actionable, relevant leads.
// Uses AI validation so irrelevant posts and broken/missing links are not shown in the radar.
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

function b64decode(data = '') {
  try {
    const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractMessageContent(payload) {
  let text = '';
  let html = '';

  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) text += b64decode(part.body.data) + '\n';
    if (part.mimeType === 'text/html' && part.body?.data) html += b64decode(part.body.data) + '\n';
    if (part.parts) part.parts.forEach(walk);
  };

  walk(payload);

  const readableHtml = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return { text: `${text}\n${readableHtml}`.trim(), html };
}

function pickKeywords(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter(k => lower.includes(k.toLowerCase()));
}

function extractContact(text) {
  const phone = (text.match(/(?:\+?972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/) || [])[0] || '';
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
  return { phone, email };
}

function normalizeUrl(rawUrl = '') {
  let url = rawUrl.replace(/[\]"'<>]+$/g, '').trim();
  if (!url.startsWith('http')) return '';

  try {
    const parsed = new URL(url);
    const nestedUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q') || parsed.searchParams.get('u');
    if (nestedUrl?.startsWith('http')) url = nestedUrl;
  } catch {
    return '';
  }

  return url;
}

function extractUrls(text, html) {
  const combined = `${text}\n${html}`;
  const urls = new Set();
  const matches = combined.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const match of matches) {
    const url = normalizeUrl(match);
    if (!url) continue;
    if (/google\.com\/alerts|accounts\.google|mail\.google|unsubscribe|support\.google/i.test(url)) continue;
    urls.add(url);
  }
  return Array.from(urls).slice(0, 8);
}

async function getReachableUrl(urls) {
  for (const url of urls.slice(0, 3)) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const pageText = contentType.includes('text/html') ? (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) : '';
        return { url: res.url || url, pageText };
      }
    } catch {
      // Broken links are ignored.
    }
  }
  return { url: '', pageText: '' };
}

function platformFromSubjectAndFrom(subject = '', from = '', sourceUrl = '') {
  const s = `${subject} ${from} ${sourceUrl}`.toLowerCase();
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('facebook') || s.includes('פייסבוק')) return 'facebook';
  if (s.includes('instagram') || s.includes('אינסטגרם')) return 'instagram';
  if (s.includes('xplace')) return 'job_board';
  if (s.includes('forum') || s.includes('פורום')) return 'forum';
  if (s.includes('jobs') || s.includes('דרושים')) return 'job_board';
  return 'other';
}

async function validateLeadWithAi(base44, candidate) {
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `סנן ליד לצלם אירועים בישראל. אשר רק אם אדם/עסק מחפש צילום עכשיו. פסול: מאמר, קורס, שירות שהצלם מוכר, עמוד שגיאה, תוכן כללי.
כותרת: ${candidate.title}
קישור: ${candidate.source_url}
טקסט: ${candidate.snippet}
עמוד: ${candidate.pageText || ''}
החזר JSON.`, 
    response_json_schema: {
      type: 'object',
      properties: {
        is_relevant: { type: 'boolean' },
        relevance_score: { type: 'number' },
        reason: { type: 'string' },
        clean_title: { type: 'string' }
      },
      required: ['is_relevant', 'relevance_score', 'reason']
    }
  });

  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const queries = [
      'newer_than:14d (subject:"Google Alert" OR from:googlealerts-noreply@google.com)',
      'newer_than:14d ("דרוש צלם" OR "מחפש צלם" OR "מחפשת צלמת" OR "photographer needed")',
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
      return Response.json({ success: true, found: 0, saved: 0, rejected: 0, summary: 'אין תוצאות חדשות בתיבת המייל' });
    }

    const existing = await base44.entities.PotentialLead.filter({}, '-created_date', 150);
    const existingUrls = new Set(existing.map(e => e.source_url).filter(Boolean));
    const existingKeys = new Set(existing.map(e => `${e.source_url || ''}|${e.title || ''}`.toLowerCase().trim()));

    const discovered = [];
    let rejected = 0;
    let aiChecks = 0;
    const maxAiChecks = 6;

    for (const id of Array.from(messageIds).slice(0, 20)) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;

      const msg = await res.json();
      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const { text, html } = extractMessageContent(msg.payload);
      const matched = pickKeywords(text);

      if (matched.length === 0) continue;

      const urls = extractUrls(text, html);
      const reachable = await getReachableUrl(urls);
      if (!reachable.url || existingUrls.has(reachable.url)) {
        rejected++;
        continue;
      }

      const idx = text.toLowerCase().indexOf(matched[0].toLowerCase());
      const snippet = text.substring(Math.max(0, idx - 60), Math.min(text.length, idx + 220)).trim();
      if (snippet.length < 40 || aiChecks >= maxAiChecks) {
        rejected++;
        continue;
      }
      const { phone, email } = extractContact(text);
      const platform = platformFromSubjectAndFrom(subject, from, reachable.url);

      const candidate = {
        title: (subject || matched[0]).substring(0, 200),
        platform,
        snippet,
        source_url: reachable.url,
        pageText: reachable.pageText,
        keywords_matched: matched.join(', '),
        contact_info: [phone, email].filter(Boolean).join(' / ') || 'N/A',
      };

      aiChecks++;
      const ai = await validateLeadWithAi(base44, candidate);
      if (!ai.is_relevant || Number(ai.relevance_score || 0) < 7) {
        rejected++;
        continue;
      }

      discovered.push({
        ...candidate,
        title: (ai.clean_title || candidate.title).substring(0, 200),
        relevance_score: Math.min(10, Math.max(1, Number(ai.relevance_score || 7))),
        notes: ai.reason || '',
      });
    }

    if (discovered.length === 0) {
      return Response.json({ success: true, found: 0, saved: 0, rejected, summary: `לא נמצאו פוסטים רלוונטיים עם קישור תקין. נפסלו ${rejected}.` });
    }

    const newOnes = discovered.filter(l => l.title && l.source_url && !existingKeys.has(`${l.source_url}|${l.title}`.toLowerCase().trim()));

    if (newOnes.length > 0 && !dryRun) {
      await base44.entities.PotentialLead.bulkCreate(newOnes.map(l => ({
        title: l.title.substring(0, 200),
        platform: l.platform,
        snippet: l.snippet?.substring(0, 500) || '',
        source_url: l.source_url,
        keywords_matched: l.keywords_matched,
        relevance_score: l.relevance_score,
        contact_info: l.contact_info,
        notes: l.notes,
        status: 'new',
      })));
    }

    return Response.json({
      success: true,
      found: discovered.length,
      saved: dryRun ? 0 : newOnes.length,
      rejected,
      dryRun,
      aiChecks,
      summary: `סריקה חסכונית הושלמה: ${discovered.length} רלוונטיים, ${rejected} נפסלו, ${aiChecks} בדיקות AI, ${dryRun ? 0 : newOnes.length} נשמרו`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});