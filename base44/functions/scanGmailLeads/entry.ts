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

// SERVICE_MAP shared between parsers
const SERVICE_MAP = {
  'promotional-video': 'סרטון תדמית',
  'social': 'צילומי סושיאל',
  'social-photography': 'צילומי סושיאל',
  'photography-course': 'קורס צילום',
  'course-price': 'קורס צילום',
  'event-photography': 'צילום אירועים',
  'sadnat-tzilum-learganim': 'סדנת צילום',
  'product-photography': 'צילום מוצרים',
  'stills': 'צילום סטילס',
  'brand-photography': 'צילומי תדמית',
  'portrait': 'צילומי תדמית',
  'afokstoruno': 'אפוק סטרונו',
  'afok-storuno': 'אפוק סטרונו',
};

function serviceFromUrl(url) {
  if (!url) return '';
  const slug = url.replace(/\/$/, '').split('/').pop();
  return SERVICE_MAP[slug] || slug || '';
}

// Parse "ליד חדש מ-[Name]" email format (Studio Gold / natigold.com plugin).
// The body looks like:
//   אפוק סטרונו          ← name (may also be in subject)
//   ofekstudent09@gmail.com
//   0546854841
//   אני אוי מאמלות...   ← consent line (skip)
//   --
//   תאריך: 08/05/2026
//   ...technical lines...
//   מקור בדפדפן: http://natigold.com/afokstoruno/
function parseStudioGoldLead(subject, body) {
  if (!body) return null;
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  console.log(`parseStudioGoldLead: subject="${subject}", lines=${lines.length}`);
  console.log(`parseStudioGoldLead: first 10 lines: ${JSON.stringify(lines.slice(0, 10))}`);

  // Extract name from subject "ליד חדש – [Name]" / "ליד חדש מ-[Name]"
  const subjectNameMatch = subject.match(/ליד חדש\s*[מ]?[־\-–—]\s*(.+)/i);
  const nameFromSubject = subjectNameMatch?.[1]?.trim() || '';
  console.log(`parseStudioGoldLead: nameFromSubject="${nameFromSubject}"`);

  // Extract email and phone using regex — more reliable than label-based parsing
  const emailMatch = body.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  const phoneMatch = body.match(/(?:(?:\+972|972|0)[\s\-]?(?:5[0-9]|[2-9])[\d\s\-]{6,10})/);
  // Extract URL — look for מקור בדפדפן or any natigold.com URL
  const urlMatch = body.match(/מקור בדפדפן[:\s]*(\S+)/i) ||
                   body.match(/(https?:\/\/[^\s\n]+natigold[^\s\n]*)/i) ||
                   body.match(/(https?:\/\/[^\s\n]+)/i);

  const email = emailMatch?.[0] || '';
  const phone = phoneMatch?.[0]?.replace(/\s/g, '') || '';
  const pageUrl = urlMatch?.[1] || '';

  console.log(`parseStudioGoldLead: email="${email}", phone="${phone}", url="${pageUrl}"`);

  // Name: from subject, or first non-email, non-phone, non-http line
  let name = nameFromSubject;
  if (!name) {
    name = lines.find(l =>
      l.length > 1 &&
      !/^https?:\/\//i.test(l) &&
      !/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i.test(l) &&
      !/^[\d\s\-\+]{7,}$/.test(l) &&
      !/^(תאריך|שעה|דפדפן|מערכת|IP|מקור|--)/i.test(l) &&
      !/^אני אוי|^אני מאשר/i.test(l)
    ) || '';
  }

  const service = serviceFromUrl(pageUrl);
  console.log(`parseStudioGoldLead: name="${name}", service="${service}"`);

  const phoneDigits = phone.replace(/[^0-9]/g, '');
  const hasPhone = phoneDigits.length >= 9;
  const hasEmail = !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  if (!name || (!hasPhone && !hasEmail)) {
    console.log(`parseStudioGoldLead: FAILED validation name="${name}" hasPhone=${hasPhone} hasEmail=${hasEmail}`);
    return null;
  }

  return {
    name,
    email,
    phone,
    service,
    notes: [service && `שירות: ${service}`, pageUrl && `URL: ${pageUrl}`].filter(Boolean).join(' | '),
    source_post_url: pageUrl,
    _format: 'studio_gold',
  };
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
  const pageUrl = get('קישור לעמוד', 'עמוד מקור', 'URL מקור', 'Source URL', 'Page URL');
  const date = get('תאריך', 'תאריך אירוע', 'Date', 'Event Date');

  // Map page URL slug to service name
  const SERVICE_MAP = {
    'promotional-video': 'סרטון תדמית',
    'social': 'צילומי סושיאל',
    'social-photography': 'צילומי סושיאל',
    'photography-course': 'קורס צילום',
    'course-price': 'קורס צילום',
    'event-photography': 'צילום אירועים',
    'sadnat-tzilum-learganim': 'סדנת צילום',
    'product-photography': 'צילום מוצרים',
    'stills': 'צילום סטילס',
    'brand-photography': 'צילומי תדמית',
    'portrait': 'צילומי תדמית',
  };
  let service = '';
  if (pageUrl) {
    const slug = pageUrl.replace(/\/$/, '').split('/').pop();
    service = SERVICE_MAP[slug] || (slug && slug !== 'natigold.com' ? slug : 'צילומי תדמית');
    if (!slug || pageUrl.replace(/\/$/, '') === 'https://natigold.com') service = 'צילומי תדמית';
  }

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
    source_post_url: pageUrl || '',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const messageIds = body.data?.new_message_ids || [];

    // Get Gmail access token
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({ success: false, error: 'gmail_not_connected' }, { status: 400 });
    }
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // If no message IDs provided (manual run), search last 30 days for contact-form emails
    let idsToProcess = messageIds;
    if (idsToProcess.length === 0) {
      const queryStr = 'newer_than:60d subject:("הודעה חדשה" OR "New Message" OR "Contact Form" OR "ליד חדש")';
      console.log(`scanGmailLeads: searching Gmail with query="${queryStr}"`);
      const query = encodeURIComponent(queryStr);
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${query}`,
        { headers: authHeader }
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`scanGmailLeads: Gmail list failed: ${errText}`);
        return Response.json({ error: 'Failed to list messages', details: errText }, { status: 500 });
      }
      const listData = await listRes.json();
      idsToProcess = (listData.messages || []).map(m => m.id);
      console.log(`scanGmailLeads: found ${idsToProcess.length} emails. IDs: ${idsToProcess.slice(0, 5).join(', ')}`);
    }

    if (idsToProcess.length === 0) {
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

      // Accept: emails from the site's notification address, contact-form subject, OR "ליד חדש" subject
      const isFromSite =
        /email@natigold\.com|wordpress@natigold\.com/i.test(from) ||
        /הודעה חדשה מאת|contact form|new message/i.test(subject) ||
        /ליד חדש/i.test(subject);

      console.log(`scanGmailLeads: msg=${msgId} subject="${subject}" from="${from}" isFromSite=${isFromSite}`);

      if (!isFromSite) {
        continue;
      }

      const text = extractBody(msg.payload);

      // The client's email is in Reply-To header (WPForms sets this automatically)
      const replyToEmail = replyTo.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || '';

      console.log(`scanGmailLeads: body length=${text.length}, preview="${text.slice(0, 200).replace(/\n/g, '|')}"`);

      // Try Studio Gold format first ("ליד חדש"), then fall back to WordPress form
      let lead = null;
      if (/ליד חדש/i.test(subject)) {
        console.log(`scanGmailLeads: trying parseStudioGoldLead for ${msgId}`);
        lead = parseStudioGoldLead(subject, text);
        if (!lead) {
          console.log(`scanGmailLeads: Studio Gold parse failed, trying WordPress parser`);
          lead = parseContactForm(text);
        }
      } else {
        lead = parseContactForm(text);
      }

      if (lead) {
        if (replyToEmail && !lead.email) lead.email = replyToEmail;
        parsed.push(lead);
        console.log(`scanGmailLeads: ✅ parsed lead name="${lead.name}" phone="${lead.phone}" email="${lead.email}" service="${lead.service}" format="${lead._format || 'wordpress'}"`);
      } else {
        console.log(`scanGmailLeads: ❌ could not parse ${msgId} subject="${subject}"`);
        console.log(`scanGmailLeads: full body = ${text.slice(0, 500)}`);
      }
    }

    if (parsed.length === 0) {
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'gmail_lead_scan',
        details: `No leads parsed from ${idsToProcess.length} emails`,
        status: 'success',
      });
      return Response.json({ success: true, found: 0, saved: 0, parsed: 0 });
    }

    // Deduplicate: first against existing DB leads, then within the parsed batch itself
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({}, '-created_date', 1000);
    const newLeads = [];
    let updatedCount = 0;

    // Build a map of already-seen phones/emails within this batch to avoid intra-batch duplicates
    const seenPhones = new Set();
    const seenEmails = new Set();

    for (const l of parsed) {
      const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
      const normalizedEmail = l.email?.toLowerCase();

      // Check against existing DB leads
      const existing =
        (normalizedPhone && existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone)) ||
        (normalizedEmail && existingLeads.find(ex => ex.email?.toLowerCase() === normalizedEmail));

      if (existing) {
        // Only update if something meaningful is missing
        const updateData = {};
        if (l.service && !existing.shooting_type) updateData.shooting_type = l.service;
        if (l.email && !existing.email) updateData.email = l.email;
        if (l.phone && !existing.phone) updateData.phone = l.phone;
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Lead.update(existing.id, updateData);
          updatedCount++;
        }
        continue;
      }

      // Check against intra-batch duplicates (same person, multiple emails)
      if (
        (normalizedPhone && seenPhones.has(normalizedPhone)) ||
        (normalizedEmail && seenEmails.has(normalizedEmail))
      ) {
        console.log(`scanGmailLeads: skipping intra-batch duplicate "${l.name}" phone="${l.phone}"`);
        continue;
      }

      if (normalizedPhone) seenPhones.add(normalizedPhone);
      if (normalizedEmail) seenEmails.add(normalizedEmail);
      newLeads.push(l);
    }

    // Save new leads to Lead entity
    const createdLeads = [];
    if (newLeads.length > 0) {
      const rows = newLeads.map(l => {
        // Extract slug from the page URL
        const urlSlug = l.source_post_url
          ? l.source_post_url.replace(/\/$/, '').split('/').pop()
          : '';
        const slugIsPage = urlSlug && urlSlug !== 'natigold.com' && !/^https?/.test(urlSlug) && urlSlug.includes('-');

        // source field: natigold.com/slug if we have a slug, otherwise generic
        const sourceLabel = slugIsPage
          ? `natigold.com • ${urlSlug}`
          : 'natigold.com (אתר)';

        // notes: service name + slug fallback + URL
        const noteParts = [];
        if (l.service) noteParts.push(`שירות: ${l.service}`);
        else if (slugIsPage) noteParts.push(`שירות: ${urlSlug}`);
        if (l.date) noteParts.push(`תאריך: ${l.date}`);
        if (l.source_post_url) noteParts.push(`URL: ${l.source_post_url}`);

        return {
          name: l.name,
          phone: l.phone || '',
          email: l.email || '',
          shooting_type: l.service || (slugIsPage ? urlSlug : ''),
          notes: noteParts.join(' | '),
          status: 'ליד חדש',
          source: sourceLabel,
          source_post_url: l.source_post_url || '',
          pipeline: 'events_b2b',
          pipeline_stage: 'lead_found',
          last_contact_date: new Date().toISOString(),
        };
      });
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
            l.source_post_url || '',
          ];
        });

        const encTab = encodeURIComponent(SHEET_TAB);
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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

    return Response.json({
      success: true,
      found: parsed.length,
      saved: newLeads.length,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('scanGmailLeads error:', error.message);
    // Log the error to SystemLog so it's visible in the UI
    try {
      const base44Err = createClientFromRequest(req);
      await base44Err.asServiceRole.entities.SystemLog.create({
        action: 'gmail_lead_scan',
        details: `שגיאה: ${error.message}`,
        status: 'error',
      });
    } catch (_) { /* ignore secondary error */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});