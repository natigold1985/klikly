// Scans Gmail for new natigold.com WordPress contact-form leads.
// Parses the actual email template from the website form, saves to Lead entity + Google Sheets.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_TAB = 'לידים מהאתר';

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
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ');
}

// Parse the natigold.com website contact form.
// Fields arrive in this order: full name, email, phone, date, submit-time, service.
// The form uses WPForms / Elementor — field labels followed by their values.
function parseContactForm(body) {
  if (!body) return null;

  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Helper: find value after a label (same line or next line)
  const get = (...labels) => {
    for (const label of labels) {
      const re = new RegExp(`^${label}\\s*[:：]?\\s*(.+)$`, 'i');
      for (let i = 0; i < lines.length; i++) {
        // "Label: value" on same line
        const sameMatch = lines[i].match(re);
        if (sameMatch?.[1]?.trim()) return sameMatch[1].trim();
        // "Label" on one line, value on next
        if (new RegExp(`^${label}\\s*[:：]?$`, 'i').test(lines[i]) && lines[i + 1]) {
          return lines[i + 1].trim();
        }
      }
    }
    return '';
  };

  // Extract fields using Hebrew label names from the form
  const name = get('שם מלא', 'שם פרטי', 'שם', 'Full Name', 'Name');
  const email = get('אימייל', 'אימייל שלך', 'מייל', 'דואר אלקטרוני', 'Email', 'E-mail');
  const phone = get('טלפון', 'טלפון נייד', 'נייד', 'Phone', 'Mobile');
  const service = get('שירות', 'סוג שירות', 'מה השירות', 'Service', 'Product', 'מוצר', 'עניין', 'תחום', 'סוג צילום', 'צילום');
  const date = get('תאריך', 'תאריך אירוע', 'Date', 'Event Date');

  // Fallback: extract phone/email from raw body if labels weren't found
  const fallbackPhone = phone || (body.match(/(?:(?:\+972|972|0)[\s\-]?(?:5[0-9]|[2-9])[\d\s\-]{7,10})/)?.[0]?.replace(/\s/g, '') || '');
  const fallbackEmail = email || (body.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || '');

  // Fallback: extract name — look for Reply-To or first line that looks like a name
  let fallbackName = name;
  if (!fallbackName) {
    // Try to find a line with 2+ Hebrew words (likely a name)
    const hebrewNameLine = lines.find(l => /^[\u05D0-\u05EA]+([\s\u05D0-\u05EA]{2,})$/.test(l));
    fallbackName = hebrewNameLine || '';
  }

  const phoneDigits = String(fallbackPhone || '').replace(/[^0-9]/g, '');
  const hasPhone = phoneDigits.length >= 9;
  const hasEmail = !!(fallbackEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallbackEmail));

  // Must have at least a name and phone/email
  if (!fallbackName || (!hasPhone && !hasEmail)) return null;

  return {
    name: fallbackName,
    email: fallbackEmail,
    phone: fallbackPhone,
    service: service || '',
    date: date || '',
    notes: [service && `שירות: ${service}`, date && `תאריך: ${date}`].filter(Boolean).join(', '),
  };
}

// In-memory guard against concurrent invocations
let isRunning = false;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const messageIds = body.data?.new_message_ids || [];

    if (isRunning) {
      console.log('scanGmailLeads: already running, skipping');
      return Response.json({ success: true, skipped: 'already_running' });
    }
    isRunning = true;

    // Circuit breaker: max 5 runs per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.SystemLog.filter(
      { action: 'gmail_lead_scan' }, '-created_date', 20
    );
    const recentCount = recentLogs.filter(l => l.created_date > oneHourAgo).length;
    if (recentCount >= 5) {
      console.warn(`scanGmailLeads: circuit-breaker tripped (${recentCount} runs/hour)`);
      isRunning = false;
      return Response.json({ success: false, error: 'rate_limited' }, { status: 429 });
    }

    // Get Gmail access token
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
    } catch (e) {
      isRunning = false;
      return Response.json({ success: false, error: 'gmail_not_connected' }, { status: 400 });
    }
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // If no message IDs provided (manual run), search last 7 days for contact-form emails
    let idsToProcess = messageIds;
    if (idsToProcess.length === 0) {
      // Accept messages from the website form sender OR messages that look like contact forms
      const query = encodeURIComponent(
        'newer_than:7d (from:email@natigold.com OR "הודעה חדשה מאת" OR "נתי גולד צילום") subject:("הודעה חדשה" OR "New Message" OR "Contact Form")'
      );
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${query}`,
        { headers: authHeader }
      );
      if (!listRes.ok) {
        isRunning = false;
        return Response.json({ error: 'Failed to list messages' }, { status: 500 });
      }
      const listData = await listRes.json();
      idsToProcess = (listData.messages || []).map(m => m.id);
    }

    if (idsToProcess.length === 0) {
      isRunning = false;
      return Response.json({ success: true, found: 0, saved: 0 });
    }

    // Fetch and parse each message
    const parsed = [];
    for (const msgId of idsToProcess.slice(0, 30)) {
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
      const replyTo = header('Reply-To');

      // Accept: emails from the site's notification address, or with contact-form subject
      const isFromSite =
        /email@natigold\.com|wordpress@natigold\.com/i.test(from) ||
        /הודעה חדשה מאת|contact form|new message/i.test(subject);

      if (!isFromSite) {
        console.log(`scanGmailLeads: skipped ${msgId} subject="${subject}" from="${from}"`);
        continue;
      }

      const text = extractBody(msg.payload);

      // The client's email is in Reply-To header (WPForms sets this automatically)
      const replyToEmail = replyTo.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || '';

      const lead = parseContactForm(text);
      if (lead) {
        // Prefer Reply-To email (actual client email) over form-body parsed email
        if (replyToEmail && !lead.email) lead.email = replyToEmail;
        parsed.push(lead);
        console.log(`scanGmailLeads: parsed lead "${lead.name}" phone="${lead.phone}" email="${lead.email}" service="${lead.service}"`);
      } else {
        console.log(`scanGmailLeads: could not parse ${msgId} subject="${subject}"`);
        console.log(`scanGmailLeads: body preview = ${text.slice(0, 300)}`);
      }
    }

    if (parsed.length === 0) {
      isRunning = false;
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'gmail_lead_scan',
        details: `No leads parsed from ${idsToProcess.length} emails`,
        status: 'success',
      });
      return Response.json({ success: true, found: 0, saved: 0, parsed: 0 });
    }

    // Deduplicate against existing leads
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({}, '-created_date', 500);
    const newLeads = [];
    let updatedCount = 0;

    for (const l of parsed) {
      const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
      const normalizedEmail = l.email?.toLowerCase();
      const existing =
        (normalizedPhone && existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone)) ||
        (normalizedEmail && existingLeads.find(ex => ex.email?.toLowerCase() === normalizedEmail));

      if (existing) {
        const updateData = {};
        if (l.service && !existing.shooting_type) updateData.shooting_type = l.service;
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

    // Save new leads to Lead entity
    const createdLeads = [];
    if (newLeads.length > 0) {
      const rows = newLeads.map(l => ({
        name: l.name,
        phone: l.phone || '',
        email: l.email || '',
        shooting_type: l.service || '',
        notes: l.notes || '',
        status: 'ליד חדש',
        source: 'natigold.com (אתר)',
        pipeline: 'events_b2b',
        pipeline_stage: 'lead_found',
        last_contact_date: new Date().toISOString(),
      }));
      const created = await base44.asServiceRole.entities.Lead.bulkCreate(rows);
      createdLeads.push(...(Array.isArray(created) ? created : newLeads));
    }

    // Write new leads to Google Sheets — לשונית "לידים מהאתר"
    // Columns: A=שם, B=טלפון, C=מקור, D=עניין, E=הודעה מוכנה
    if (newLeads.length > 0) {
      try {
        const sheetsConn = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const sheetsAuth = { Authorization: `Bearer ${sheetsConn.accessToken}` };

        const values = newLeads.map(l => {
          const waMsg = `היי ${l.name.split(' ')[0]}, קיבלתי את הפנייה שלך${l.service ? ` בנושא ${l.service}` : ''}. אחזור אליך בהקדם 🙏`;
          return [
            l.name,
            l.phone,
            'natigold.com (אתר)',
            l.service || '',
            waMsg,
          ];
        });

        const encTab = encodeURIComponent(SHEET_TAB);
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const sheetsRes = await fetch(appendUrl, {
          method: 'POST',
          headers: { ...sheetsAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });

        if (!sheetsRes.ok) {
          const err = await sheetsRes.text();
          console.error('scanGmailLeads: Sheets append failed:', err);
        } else {
          console.log(`scanGmailLeads: appended ${values.length} rows to Sheets tab "${SHEET_TAB}"`);
        }
      } catch (e) {
        console.error('scanGmailLeads: Sheets error:', e.message);
      }
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'gmail_lead_scan',
      details: `Parsed: ${parsed.length}, New: ${newLeads.length}, Updated: ${updatedCount}, Sheets: ${newLeads.length}`,
      status: 'success',
    });

    isRunning = false;
    return Response.json({
      success: true,
      found: parsed.length,
      saved: newLeads.length,
      updated: updatedCount,
    });
  } catch (error) {
    isRunning = false;
    console.error('scanGmailLeads error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});