import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_NAME = 'Claude Code';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  const local = digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
  if (!local || /^(\d)\1+$/.test(local)) return false;
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

function isInvalidClaudeRow(row) {
  const name = row[1];
  const phone = row[2];
  const email = row[3];
  const source = row[4];
  const link = row[8];
  return !hasFullName(name) || (!isValidPhone(phone) && !isValidEmail(email)) || !String(source || '').trim() || !isDirectSourceUrl(link);
}

function potentialLeadName(record) {
  return String(record.title || '').split('—')[0].trim();
}

function isInvalidPotentialLead(record) {
  const contact = record.contact_info || '';
  return !hasFullName(potentialLeadName(record)) || (!isValidPhone(contact) && !isValidEmail(contact)) || !record.keywords_matched || !isDirectSourceUrl(record.source_url);
}

function leadText(record) {
  return [
    record.name,
    record.title,
    record.source,
    record.shooting_type,
    record.role_title,
    record.notes,
    record.snippet,
    record.keywords_matched,
    record.source_post_url,
    record.source_url,
  ].filter(Boolean).join(' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const range = encodeURIComponent(`'${SHEET_NAME}'!A1:K1000`);
    const readResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!readResp.ok) {
      const details = await readResp.text();
      return Response.json({ error: 'Failed to read Claude Code sheet', details }, { status: readResp.status });
    }

    const sheetData = await readResp.json();
    const rows = sheetData.values || [];
    let sheetMarked = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!isIrrelevantMarketingLead(...row) && !isInvalidClaudeRow(row)) continue;
      const rowNumber = i + 1;
      const updateRange = encodeURIComponent(`'${SHEET_NAME}'!A${rowNumber}:K${rowNumber}`);
      const nextRow = [...row];
      while (nextRow.length < 11) nextRow.push('');
      nextRow[0] = 'לא רלוונטי';
      nextRow[10] = new Date().toISOString().slice(0, 10);
      const updateResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [nextRow.slice(0, 11)] }),
      });
      if (updateResp.ok) sheetMarked++;
    }

    const potentialLeads = await base44.asServiceRole.entities.PotentialLead.list('-created_date', 1000);
    let potentialDeleted = 0;
    for (const lead of potentialLeads) {
      if (isIrrelevantMarketingLead(leadText(lead)) || isInvalidPotentialLead(lead)) {
        await base44.asServiceRole.entities.PotentialLead.delete(lead.id);
        potentialDeleted++;
      }
    }

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
    let leadsDeleted = 0;
    for (const lead of leads) {
      if (isIrrelevantMarketingLead(leadText(lead))) {
        await base44.asServiceRole.entities.Lead.delete(lead.id);
        leadsDeleted++;
      }
    }

    return Response.json({ success: true, sheetMarked, potentialDeleted, leadsDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});