import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

let isRunning = false;

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit?gid=1759133320#gid=1759133320';

const HEADER_KEYS = {
  name: ['name', 'שם', 'שם מלא', 'fullname', 'lead'],
  phone: ['phone', 'טלפון', 'tel', 'mobile', 'נייד'],
  email: ['email', 'מייל', 'דוא"ל', 'דואל', 'mail', 'e-mail'],
  source: ['source', 'מקור', 'platform', 'פלטפורמה', 'ערוץ'],
  type: ['type', 'סוג', 'סוג שירות', 'service', 'shoot type'],
  address: ['address', 'כתובת', 'city', 'עיר'],
  notes: ['note', 'הערה', 'הערות', 'message', 'הודעה', 'תוכן הודעה', 'תיאור'],
  link: ['link', 'קישור', 'url', 'source url', 'source_url', 'קישור מקור', 'קישור ליד'],
  company: ['company', 'חברה', 'תפקיד', 'role', 'job', 'position'],
  status: ['סטטוס', 'status'],
};

function findColumnIndex(headers, keys) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase().trim();
    if (!header) continue;
    if (keys.some((key) => header.includes(key.toLowerCase()))) return i;
  }
  return -1;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  const local = digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
  if (!local || /^(\d)\1+$/.test(local)) return false;
  if (/123456|234567|345678|456789|987654|876543|765432|654321/.test(local)) return false;
  if (/(\d)\1{2,}/.test(local)) return false;
  return /^05\d{8}$/.test(local) || /^0[23489]\d{7}$/.test(local);
}

function isValidEmail(email) {
  return !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()));
}

function isFullName(name) {
  const clean = String(name || '').trim();
  const low = clean.toLowerCase();
  const bad = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא', 'שם'];
  if (!clean || bad.includes(low)) return false;
  if (/^https?:\/\//i.test(clean) || clean.includes('@')) return false;
  if (clean.replace(/[^0-9]/g, '').length >= 7) return false;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (/מנהל|מנהלת|אחראי|אחראית|marcom|marketing|communications|manager|תפקיד|חברה|מחלקה/i.test(clean)) return false;
  return /[א-תa-zA-Z]/.test(clean);
}

function extractSpreadsheetId(sheetUrl) {
  const trimmed = String(sheetUrl || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
}

function extractUrl(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const match = text.match(/https?:\/\/[^\s|,)>"]+/i);
  return match ? match[0].replace(/[)\]"'<>.,]+$/g, '') : '';
}

function isDirectSourceUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (/google\.[^/]+\/search|natigold\.com|\/groups\/?$|facebook\.com\/groups\/[^/]+\/?$/.test(lower)) return false;
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.replace(/\/+$/, '');
    if (!path || path === '' || path === '/he' || path.split('/').filter(Boolean).length < 2) return false;
  } catch (_) {
    return false;
  }
  return true;
}

function isIrrelevantMarketingLead(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  return /מנהל\s*שיווק|מנהלת\s*שיווק|שיווק\s*בינלאומי|marketing\s*manager|intl\.\s*marketing|international\s*marketing|marcom/.test(text);
}

function detectSource(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (text.includes('linkedin')) return 'LinkedIn';
  if (text.includes('facebook') || text.includes('fb.com')) return 'Facebook';
  if (text.includes('instagram') || text.includes('ig.me') || text.includes('אינסטגרם')) return 'Instagram';
  if (text.includes('whatsapp') || text.includes('wa.me') || text.includes('וואטסאפ')) return 'WhatsApp';
  if (text.includes('google')) return 'Google Sheets';
  if (text.includes('elbitsystems') || text.includes('defense') || text.includes('ביטחון')) return 'Defense Industry';
  return null;
}

function tabNameToSource(tabName) {
  const text = String(tabName || '').toLowerCase();
  if (text.includes('claude code')) return 'Claude Code';
  if (text.includes('אינסטגרם') || text.includes('instagram')) return 'Instagram';
  if (text.includes('פייסבוק') || text.includes('facebook')) return 'Facebook';
  if (text.includes('linkedin') || text.includes('לינקדאין')) return 'LinkedIn';
  if (text.includes('קורס')) return 'Course Lead';
  if (text.includes('ביטחון')) return 'Defense Industry';
  return 'Google Sheets';
}

function classifyPipeline(source = '', notes = '', type = '') {
  const text = [source, notes, type].join(' ').toLowerCase();
  if (/רפאל|אלביט|תעא|תעשייה אווירית|iai|rafael|elbit|defense|ביטחון|ביטחונית/.test(text)) {
    return { pipeline: 'defense_industry', pipeline_stage: 'lead_found' };
  }
  if (/webinar|וובינר|ai|בינה מלאכותית|תדמית ai/.test(text)) {
    return { pipeline: 'ai_webinar', pipeline_stage: 'registered_webinar' };
  }
  return { pipeline: 'events_b2b', pipeline_stage: 'quote_sent' };
}

async function cleanupInvalidLeads(base44) {
  const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
  let deleted = 0;
  const reasons = { invalid_name: 0, no_valid_contact: 0 };

  for (const lead of leads) {
    const hasValidName = isFullName(lead.name);
    const hasValidContact = isValidPhone(lead.phone) || isValidEmail(lead.email);
    if (!hasValidName || !hasValidContact) {
      await base44.asServiceRole.entities.Lead.delete(lead.id);
      deleted++;
      if (!hasValidName) reasons.invalid_name++;
      else reasons.no_valid_contact++;
    }
  }

  return { scanned: leads.length, deleted, reasons };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (isRunning) return Response.json({ success: true, skipped: 'already_running' });
    isRunning = true;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.SystemLog.filter({ action: 'scheduled_sheets_sync' }, '-created_date', 10);
    const recentCount = recentLogs.filter((log) => log.created_date > oneHourAgo).length;
    if (recentCount >= 4) {
      isRunning = false;
      return Response.json({ success: false, error: 'rate_limited', recentCount }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const spreadsheetId = extractSpreadsheetId(body.sheetUrl || DEFAULT_SHEET_URL);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResp.ok) return Response.json({ error: 'Failed to load spreadsheet metadata' }, { status: metaResp.status });
    const meta = await metaResp.json();
    const tabs = (meta.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);

    const ranges = tabs.map((tab) => `ranges=${encodeURIComponent(`'${tab}'!A1:Z1000`)}`).join('&');
    const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!valuesResp.ok) return Response.json({ error: 'Failed to fetch sheet values' }, { status: valuesResp.status });
    const valuesData = await valuesResp.json();
    const valueRanges = valuesData.valueRanges || [];

    const existing = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
    const phoneMap = {};
    const emailMap = {};
    const nameSourceMap = {};
    for (const lead of existing) {
      const phoneKey = normalizePhone(lead.phone);
      if (phoneKey) phoneMap[phoneKey] = lead;
      if (lead.email) emailMap[String(lead.email).toLowerCase().trim()] = lead;
      if (lead.name) nameSourceMap[`${String(lead.name).toLowerCase().trim()}|${String(lead.source || '').toLowerCase().trim()}`] = lead;
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const perTab = [];

    for (let t = 0; t < valueRanges.length; t++) {
      const tabName = tabs[t] || `Tab${t}`;
      const rows = valueRanges[t]?.values || [];
      let tabAdded = 0;
      let tabUpdated = 0;
      let tabSkipped = 0;

      if (rows.length < 2) {
        perTab.push({ tab: tabName, added: 0, updated: 0, skipped: 0, note: 'empty' });
        continue;
      }

      const headers = rows[0];
      let idx = {
        name: findColumnIndex(headers, HEADER_KEYS.name),
        phone: findColumnIndex(headers, HEADER_KEYS.phone),
        email: findColumnIndex(headers, HEADER_KEYS.email),
        source: findColumnIndex(headers, HEADER_KEYS.source),
        type: findColumnIndex(headers, HEADER_KEYS.type),
        address: findColumnIndex(headers, HEADER_KEYS.address),
        notes: findColumnIndex(headers, HEADER_KEYS.notes),
        link: findColumnIndex(headers, HEADER_KEYS.link),
        company: findColumnIndex(headers, HEADER_KEYS.company),
        status: findColumnIndex(headers, HEADER_KEYS.status),
      };

      if (tabName.toLowerCase().includes('claude code')) {
        idx = { status: 0, name: 1, phone: 2, email: 3, source: 4, type: 5, address: -1, notes: 7, link: 8, company: -1 };
      }

      if (idx.name === -1 && idx.phone === -1 && idx.email === -1) {
        perTab.push({ tab: tabName, added: 0, updated: 0, skipped: 0, note: 'no-recognizable-columns' });
        continue;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((cell) => !cell || !String(cell).trim())) continue;
        const get = (index) => index !== -1 ? String(row[index] || '').trim() : '';

        const name = get(idx.name);
        const phone = get(idx.phone);
        const email = get(idx.email);
        const sourceCol = get(idx.source);
        const type = get(idx.type);
        const address = get(idx.address);
        const notesCol = get(idx.notes);
        const link = get(idx.link);
        const company = get(idx.company);
        const notes = [notesCol, company ? `חברה/תפקיד: ${company}` : '', link ? `קישור: ${link}` : ''].filter(Boolean).join(' | ');
        const source = detectSource(sourceCol, link, notes) || sourceCol || tabNameToSource(tabName);
        const sourceUrl = extractUrl(link, notesCol, sourceCol);

        if (!isFullName(name) || (!isValidPhone(phone) && !isValidEmail(email))) {
          skipped++; tabSkipped++;
          continue;
        }

        if (isIrrelevantMarketingLead(name, sourceCol, type, notesCol, company) || !isDirectSourceUrl(sourceUrl)) {
          skipped++; tabSkipped++;
          continue;
        }

        const phoneKey = normalizePhone(phone);
        const emailKey = String(email || '').toLowerCase().trim();
        const nameSourceKey = `${name.toLowerCase().trim()}|${source.toLowerCase().trim()}`;
        const match = (phoneKey && phoneMap[phoneKey]) || (emailKey && emailMap[emailKey]) || nameSourceMap[nameSourceKey];

        if (match) {
          const updates = {};
          if (email && !match.email) updates.email = email;
          if (phone && !match.phone) updates.phone = phone;
          if (source && !match.source) updates.source = source;
          if (sourceUrl && !match.source_post_url) updates.source_post_url = sourceUrl;
          if (type && !match.shooting_type) updates.shooting_type = type;
          if (address && !match.address) updates.address = address;
          if (notes && !match.notes) updates.notes = notes;
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Lead.update(match.id, updates);
            Object.assign(match, updates);
            updated++; tabUpdated++;
          }
        } else {
          const pipelineData = classifyPipeline(source, notes, type);
          const created = await base44.asServiceRole.entities.Lead.create({
            name,
            phone: phone || '',
            email: email || undefined,
            source,
            source_post_url: sourceUrl,
            shooting_type: type || undefined,
            address: address || undefined,
            notes: notes || undefined,
            status: 'ליד חדש',
            pipeline: pipelineData.pipeline,
            pipeline_stage: pipelineData.pipeline_stage,
            last_contact_date: new Date().toISOString(),
            is_filtered: false,
          });
          added++; tabAdded++;
          if (phoneKey) phoneMap[phoneKey] = created;
          if (emailKey) emailMap[emailKey] = created;
          nameSourceMap[nameSourceKey] = created;
        }
      }

      perTab.push({ tab: tabName, added: tabAdded, updated: tabUpdated, skipped: tabSkipped });
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'scheduled_sheets_sync',
      details: `Sync complete. Added: ${added}, Updated: ${updated}, Skipped: ${skipped}`,
      status: 'success',
    });

    isRunning = false;
    return Response.json({ success: true, added, updated, skipped, per_tab: perTab });
  } catch (error) {
    isRunning = false;
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});