import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
  return digits.length >= 9 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
}

function isValidEmail(email) {
  return !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()));
}

function extractUrl(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const match = text.match(/https?:\/\/[^\s|,)>"]+/i);
  return match ? match[0].replace(/[)\]"'<>.,]+$/g, '') : '';
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

function isActionableRow({ name, phone, email, sourceUrl, sent }) {
  const cleanName = String(name || '').trim().toLowerCase();
  if (!name || ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?'].includes(cleanName)) return false;
  if (!isValidPhone(phone) && !isValidEmail(email)) return false;
  if (!sourceUrl) return false;
  if (String(sent || '').trim() === 'כן') return false;
  return true;
}

function buildPotentialLead(row) {
  const status = getCell(row, 0);
  const name = getCell(row, 1);
  const phone = getCell(row, 2);
  const email = getCell(row, 3);
  const source = getCell(row, 4) || 'Claude Code';
  const service = getCell(row, 5);
  const date = getCell(row, 6);
  const notes = getCell(row, 7);
  const link = getCell(row, 8);
  const sent = getCell(row, 9);
  const updateDate = getCell(row, 10);
  const sourceUrl = extractUrl(link, notes, source);

  if (!isActionableRow({ name, phone, email, sourceUrl, sent })) return null;

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

    const existing = await base44.asServiceRole.entities.PotentialLead.filter({}, '-created_date', 300);
    const existingKeys = new Set(existing.map((lead) => `${lead.source_url || ''}|${lead.title || ''}`.toLowerCase().trim()));
    const newOnes = candidates.filter((lead) => !existingKeys.has(`${lead.source_url}|${lead.title}`.toLowerCase().trim()));

    if (newOnes.length > 0 && !dryRun) {
      await base44.asServiceRole.entities.PotentialLead.bulkCreate(newOnes);
    }

    return Response.json({
      success: true,
      source: 'Claude Code',
      found: candidates.length,
      saved: dryRun ? 0 : newOnes.length,
      rejected: Math.max(0, rows.length - 1 - candidates.length),
      dryRun,
      summary: `Claude Code Radar: ${candidates.length} תקינים, ${newOnes.length} חדשים`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});