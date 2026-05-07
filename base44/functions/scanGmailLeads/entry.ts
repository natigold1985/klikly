// Scans Gmail for new natigold.com WordPress contact-form leads.
// Uses deterministic regex parsing on the known form structure — no LLM credits needed.
// Falls back to LLM ONLY for emails that look like a lead but don't match the WP template.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Decode base64-url Gmail body
function b64decode(data = '') {
  try {
    const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractBody(payload) {
  let text = '';
  let html = '';
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += b64decode(part.body.data) + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += b64decode(part.body.data) + '\n';
    }
    if (part.parts) part.parts.forEach(walk);
  };
  walk(payload);
  if (text.trim()) return text;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parse the standard natigold.com WP form. Returns null if it doesn't match.
function parseWordPressForm(body) {
  if (!body) return null;
  const normalizedBody = body
    .replace(/\s+/g, ' ')
    .replace(/\s*[:：]\s*/g, ': ');
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const get = (label) => {
    // matches: "label: value", "label : value", or label on one line and value on the next line
    const sameLine = new RegExp(`${label}\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
    const m = body.match(sameLine);
    if (m?.[1]?.trim()) return m[1].trim();

    const inline = new RegExp(`${label}\\s*[:：]\\s*(.{2,80}?)(?=\\s+(שם פרטי|שם מלא|שם|טלפון|טלפון נייד|נייד|אימייל|מייל|דואר אלקטרוני|תאריך|תאריך אירוע|שעה|URL מקור|דף מקור|עמוד מקור|Name|Phone|Email|Date|Time|$))`, 'i');
    const inlineMatch = normalizedBody.match(inline);
    if (inlineMatch?.[1]?.trim()) return inlineMatch[1].trim();

    const labelLine = new RegExp(`^${label}\\s*[:：]?$`, 'i');
    const index = lines.findIndex(line => labelLine.test(line));
    if (index >= 0) return lines[index + 1] || '';

    return '';
  };

  const name = get('שם פרטי') || get('שם מלא') || get('שם') || get('Name') || get('Full Name');
  const phone = get('טלפון') || get('טלפון נייד') || get('נייד') || get('Phone') || get('Mobile');
  const email = get('אימייל') || get('אימייל שלך') || get('מייל') || get('דואר אלקטרוני') || get('Email') || get('E-mail');
  const eventDate = get('תאריך') || get('תאריך אירוע') || get('תאריך האירוע') || get('Date') || get('Event Date');
  const eventTime = get('שעה') || get('שעת אירוע') || get('שעת האירוע') || get('Time') || get('Event Time');
  const sourceUrl = get('URL מקור') || get('דף מקור') || get('עמוד מקור') || get('Source URL') || get('Page URL');

  const fallbackPhone = phone || (body.match(/(?:\+972|0)(?:[\d\s\-()]){8,}/)?.[0] || '');
  const fallbackEmail = email || (body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '');

  const phoneDigits = String(fallbackPhone || '').replace(/[^0-9]/g, '');
  const hasValidPhone = phoneDigits.length === 10 && !/^(\d)\1+$/.test(phoneDigits);
  const hasValidEmail = !!(fallbackEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fallbackEmail).trim()));
  const hasFullName = String(name || '').trim().split(/\s+/).filter(Boolean).length >= 2;
  const hasSourceUrl = /^https?:\/\//i.test(sourceUrl || '');

  if (!hasFullName || (!hasValidPhone && !hasValidEmail) || !hasSourceUrl) return null;

  // Detect shooting type from source URL or body
  let shooting_type = '';
  const lowerBody = body.toLowerCase();
  const lowerUrl = sourceUrl.toLowerCase();
  if (/wedding|חתונה/i.test(lowerBody) || /wedding/i.test(lowerUrl)) shooting_type = 'חתונה';
  else if (/bar.?mitzvah|בר מצווה|בת מצווה/i.test(lowerBody)) shooting_type = 'בר/בת מצווה';
  else if (/event|אירוע/i.test(lowerUrl)) shooting_type = 'אירוע';
  else if (/portrait|תדמית/i.test(lowerBody)) shooting_type = 'תדמית';
  else if (/family|משפחה/i.test(lowerBody)) shooting_type = 'משפחה';

  const noteParts = [];
  if (eventDate) noteParts.push(`תאריך: ${eventDate}${eventTime ? ' ' + eventTime : ''}`);
  if (sourceUrl) {
    const slug = sourceUrl.split('/').filter(Boolean).pop() || '';
    if (slug) noteParts.push(`מקור: ${slug.split('#')[0]}`);
  }

  return {
    name,
    phone: fallbackPhone.replace(/[^\d+\-\s()]/g, '').trim(),
    email: fallbackEmail,
    shooting_type,
    notes: noteParts.join(', '),
    source_post_url: sourceUrl,
  };
}

// In-memory guard against concurrent / runaway invocations within a single deploy instance.
// (Cold starts reset this — combined with the DB circuit-breaker below for cross-instance safety.)
let isRunning = false;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const messageIds = body.data?.new_message_ids || [];

    // ── Concurrency guard ─────────────────────────────────────────────
    if (isRunning) {
      console.log('scanGmailLeads: already running, skipping duplicate invocation');
      return Response.json({ success: true, skipped: 'already_running' });
    }
    isRunning = true;

    // ── Circuit breaker: prevent runaway loops ────────────────────────
    // Count how many times this function ran in the last 60 minutes via SystemLog.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.SystemLog.filter(
      { action: 'gmail_lead_scan' },
      '-created_date',
      20
    );
    const recentCount = recentLogs.filter(l => l.created_date > oneHourAgo).length;
    if (recentCount >= 5) {
      console.warn(`scanGmailLeads: circuit-breaker tripped — ${recentCount} runs in last hour. Aborting.`);
      isRunning = false;
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'gmail_lead_scan_blocked',
        details: `Circuit breaker tripped: ${recentCount} runs in last 60min`,
        status: 'error',
      });
      return Response.json({ success: false, error: 'rate_limited', recentCount }, { status: 429 });
    }

    // Connector with single retry — if no auth, abort cleanly (no loop).
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
    } catch (e) {
      isRunning = false;
      console.error('scanGmailLeads: Gmail not connected:', e.message);
      return Response.json({ success: false, error: 'gmail_not_connected' }, { status: 400 });
    }
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let idsToProcess = messageIds;

    if (idsToProcess.length === 0) {
      // Scan recent WordPress/contact-form notifications. Some Gmail messages arrive from wordpress@natigold.com,
      // while others only expose the Hebrew subject/body, so don't rely only on the From header.
      const query = encodeURIComponent('newer_than:7d (natigold.com OR wordpress OR wpforms OR elementor OR "contact form" OR "הודעה חדשה מאת" OR "שם פרטי" OR "טלפון")');
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${query}`,
        { headers: authHeader }
      );
      if (!listRes.ok) {
        return Response.json({ error: 'Failed to list messages' }, { status: 500 });
      }
      const listData = await listRes.json();
      idsToProcess = (listData.messages || []).map(m => m.id);
    }

    if (idsToProcess.length === 0) {
      isRunning = false;
      return Response.json({ success: true, found: 0, saved: 0 });
    }

    // Fetch + parse — no LLM in the happy path
    // STRICT: only process emails coming from the website contact form (natigold.com).
    const parsed = [];
    for (const msgId of idsToProcess.slice(0, 20)) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const msg = await res.json();
      const headers = msg.payload?.headers || [];
      const header = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      const subject = header('Subject');
      const from = header('From');
      const to = header('To');
      const replyTo = header('Reply-To');

      const text = extractBody(msg.payload);
      const combined = `${from}\n${to}\n${replyTo}\n${subject}\n${text}`;

      // Website-only filter: accept only messages that clearly came from the natigold.com contact form.
      const isWebsiteForm =
        /natigold\.com|wordpress|wpforms|elementor|contact form|טופס|הודעה חדשה מאת/i.test(combined) &&
        /שם פרטי|שם מלא|שם|טלפון|טלפון נייד|אימייל|מייל|דואר אלקטרוני|Phone|Email|Name/i.test(text);
      if (!isWebsiteForm) {
        console.log(`scanGmailLeads: skipped non-website email ${msgId} subject="${subject}" from="${from}"`);
        continue;
      }

      const lead = parseWordPressForm(text);
      if (lead) {
        parsed.push(lead);
      } else {
        console.log(`scanGmailLeads: website email matched but could not parse ${msgId} subject="${subject}"`);
      }
    }
    const unparsed = []; // No LLM fallback — strict website-only mode

    // Optional fallback to LLM only when we have unparsed but possibly relevant emails
    let llmLeads = [];
    if (unparsed.length > 0) {
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract photography leads from these Hebrew/English emails. Return only real leads with name + (phone or email).
Emails:
${unparsed.map(e => `From: ${e.from}\nSubject: ${e.subject}\n${e.body}\n---`).join('\n')}`,
          response_json_schema: {
            type: 'object',
            properties: {
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    shooting_type: { type: 'string' },
                    notes: { type: 'string' },
                  }
                }
              }
            }
          }
        });
        llmLeads = (result.leads || []).filter(l => l.name && (l.phone || l.email));
      } catch (e) {
        console.error('LLM fallback failed:', e.message);
      }
    }

    const allLeads = [...parsed, ...llmLeads];
    if (allLeads.length === 0) {
      isRunning = false;
      return Response.json({ success: true, found: 0, saved: 0, parsed: 0, llmFallback: 0 });
    }

    // Deduplicate
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({}, '-created_date', 500);
    const newLeads = [];
    let updatedCount = 0;

    for (const l of allLeads) {
      const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
      const normalizedEmail = l.email?.toLowerCase();
      const existing =
        (normalizedPhone && existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone)) ||
        (normalizedEmail && existingLeads.find(ex => ex.email?.toLowerCase() === normalizedEmail));

      if (existing) {
        const updateData = {};
        if (l.shooting_type && !existing.shooting_type) updateData.shooting_type = l.shooting_type;
        if (l.notes) updateData.notes = [existing.notes, l.notes].filter(Boolean).join(' | ');
        if (l.email && !existing.email) updateData.email = l.email;
        if (l.phone && !existing.phone) updateData.phone = l.phone;
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Lead.update(existing.id, updateData);
          updatedCount++;
        }
      } else {
        newLeads.push(l);
      }
    }

    if (newLeads.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkCreate(newLeads.map(l => ({
        name: l.name,
        phone: l.phone || '',
        email: l.email || '',
        shooting_type: l.shooting_type || '',
        notes: l.notes || '',
        status: 'new',
        source: 'natigold.com (Gmail)',
        source_post_url: l.source_post_url,
        pipeline: /webinar|וובינר|ai|בינה מלאכותית/i.test(`${l.notes || ''} ${l.source_post_url || ''}`) ? 'ai_webinar' : 'events_b2b',
        pipeline_stage: /webinar|וובינר|ai|בינה מלאכותית/i.test(`${l.notes || ''} ${l.source_post_url || ''}`) ? 'registered_webinar' : 'quote_sent',
        last_contact_date: new Date().toISOString(),
      })));
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'gmail_lead_scan',
      details: `Parsed: ${parsed.length}, LLM fallback: ${llmLeads.length}, New: ${newLeads.length}, Updated: ${updatedCount}`,
      status: 'success',
    });

    isRunning = false;
    return Response.json({
      success: true,
      found: allLeads.length,
      saved: newLeads.length,
      updated: updatedCount,
      parsed: parsed.length,
      llmFallback: llmLeads.length,
    });
  } catch (error) {
    isRunning = false;
    return Response.json({ error: error.message }, { status: 500 });
  }
});