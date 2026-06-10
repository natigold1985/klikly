import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_NAME = 'Claude Code';

function getCell(row, index) {
  return String(row[index] || '').trim();
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

function hasFullName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean || ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?'].includes(clean.toLowerCase())) return false;
  const parts = clean.split(' ').filter((part) => part.length >= 2);
  return parts.length >= 2 && clean.length >= 5;
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

function platformFromText(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (text.includes('facebook') || text.includes('fb.com')) return 'facebook';
  if (text.includes('instagram') || text.includes('ig.me') || text.includes('אינסטגרם')) return 'instagram';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('alljobs') || text.includes('drushim') || text.includes('xplace') || text.includes('דרושים')) return 'job_board';
  if (text.includes('forum') || text.includes('פורום') || text.includes('prog.co.il')) return 'forum';
  return 'other';
}

function scoreLead({ phone, email, sourceUrl, source, notes }) {
  let score = 6;
  if (isValidPhone(phone)) score += 2;
  if (isValidEmail(email)) score += 1;
  if (sourceUrl) score += 1;
  if (/defense|ביטחון|elbit|rafael|iai|תעשייה/i.test(`${source} ${notes}`)) score += 1;
  return Math.min(10, score);
}

function isActionableRow({ name, phone, email, sourceUrl, sent, source, service, notes }) {
  if (!hasFullName(name)) return false;
  if (!String(source || '').trim()) return false;
  if (isIrrelevantMarketingLead(name, source, service, notes)) return false;
  if (!isValidPhone(phone) && !isValidEmail(email)) return false;
  if (!isDirectSourceUrl(sourceUrl)) return false;
  if (String(sent || '').trim() === 'כן') return false;
  return true;
}

function buildPotentialLead(row) {
  const status = getCell(row, 0);
  const name = getCell(row, 1);
  const phone = getCell(row, 2);
  const email = getCell(row, 3);
  const source = getCell(row, 4);
  const service = getCell(row, 5);
  const date = getCell(row, 6);
  const notes = getCell(row, 7);
  const link = getCell(row, 8);
  const sent = getCell(row, 9);
  const updateDate = getCell(row, 10);
  const sourceUrl = extractUrl(link, notes, source);

  if (!isActionableRow({ name, phone, email, sourceUrl, sent, source, service, notes })) return null;

  const titleParts = [name, service || source].filter(Boolean);
  const snippetParts = [service, notes, date ? `תאריך: ${date}` : '', updateDate ? `עדכון: ${updateDate}` : ''].filter(Boolean);
  const contactInfo = [phone, email].filter(Boolean).join(' / ');
  const platform = platformFromText(source, sourceUrl, notes);

  return {
    title: titleParts.join(' — ').slice(0, 200),
    platform,
    snippet: snippetParts.join(' | ').slice(0, 500),
    source_url: sourceUrl,
    keywords_matched: [source, service].filter(Boolean).join(', '),
    relevance_score: scoreLead({ phone, email, sourceUrl, source, notes }),
    contact_info: contactInfo,
    notes: [`Claude Code`, status ? `סטטוס: ${status}` : '', sent ? `נשלחה: ${sent}` : ''].filter(Boolean).join(' | '),
    status: 'new',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const range = encodeURIComponent(`'${SHEET_NAME}'!A1:Z1000`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const details = await res.text();
      return Response.json({ error: 'Failed to read Claude Code radar sheet', details }, { status: res.status });
    }

    const data = await res.json();
    const rows = data.values || [];
    const candidates = rows.slice(1).map(buildPotentialLead).filter(Boolean);

    // Write directly to Google Sheets instead of creating PotentialLead entities
    const existingRows = rows.slice(1);
    const existingKeys = new Set(existingRows.map(row => {
      const link = getCell(row, 8);
      const title = getCell(row, 0);
      return `${link}|${title}`.toLowerCase().trim();
    }));

    const newRows = candidates.filter(lead => 
      !existingKeys.has(`${lead.source_url}|${lead.title}`.toLowerCase().trim())
    ).map(lead => [
      lead.title,
      '',
      lead.contact_info.split(' / ')[0] || '',
      lead.contact_info.split(' / ')[1] || '',
      lead.keywords_matched,
      lead.snippet,
      '',
      lead.notes,
      lead.source_url,
      '',
      new Date().toISOString().slice(0, 10),
    ]);

    let savedCount = 0;
    if (newRows.length > 0 && !dryRun) {
      const appendRange = encodeURIComponent(`'${SHEET_NAME}'!A:K`);
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: newRows }),
        }
      );
      if (appendRes.ok) savedCount = newRows.length;
    }

    return Response.json({
      success: true,
      source: 'Claude Code Radar',
      found: candidates.length,
      saved: dryRun ? 0 : savedCount,
      rejected: Math.max(0, rows.length - 1 - candidates.length),
      dryRun,
      summary: `Claude Code Radar: ${candidates.length} תקינים, ${savedCount} חדשים (Google Sheets בלבד)`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});