import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_NAME = 'Claude Code';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
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

function mapStatus(status) {
  const value = String(status || '').trim();
  if (['נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'לא רלוונטי'].includes(value)) return value;
  return 'חדש';
}

function buildRow(lead) {
  const now = new Date().toISOString().slice(0, 10);
  return [
    mapStatus(lead.status),
    lead.name || '',
    lead.phone || '',
    lead.email || '',
    lead.source || 'CRM',
    lead.shooting_type || lead.lead_type || '',
    lead.event_date || '',
    lead.notes || '',
    lead.source_post_url || '',
    lead.status === 'נשלח פולו-אפ' ? 'כן' : '',
    now,
  ];
}

function findMatchingRow(rows, lead) {
  const targetPhone = normalizePhone(lead.phone);
  const targetEmail = normalizeText(lead.email);
  const targetUrl = normalizeText(lead.source_post_url);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rowPhone = normalizePhone(row[2]);
    const rowEmail = normalizeText(row[3]);
    const rowUrl = normalizeText(row[8]);
    if ((targetPhone && rowPhone === targetPhone) || (targetEmail && rowEmail === targetEmail) || (targetUrl && rowUrl === targetUrl)) {
      return i + 1;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const lead = body.data || body.lead || body;

    if (!lead || !lead.name) {
      return Response.json({ success: false, skipped: 'missing_lead' });
    }

    if (!isDirectSourceUrl(lead.source_post_url)) {
      return Response.json({ success: true, skipped: 'missing_direct_source_url' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const range = encodeURIComponent(`'${SHEET_NAME}'!A1:K1000`);
    const readResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!readResp.ok) {
      const details = await readResp.text();
      return Response.json({ error: 'Failed to read Claude Code sheet', details }, { status: readResp.status });
    }

    const values = await readResp.json();
    const rows = values.values || [];
    const rowValues = buildRow(lead);
    const matchRow = findMatchingRow(rows, lead);

    if (matchRow) {
      const updateRange = encodeURIComponent(`'${SHEET_NAME}'!A${matchRow}:K${matchRow}`);
      const updateResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowValues] }),
      });
      if (!updateResp.ok) {
        const details = await updateResp.text();
        return Response.json({ error: 'Failed to update Claude Code row', details }, { status: updateResp.status });
      }
      return Response.json({ success: true, action: 'updated', row: matchRow });
    }

    const appendRange = encodeURIComponent(`'${SHEET_NAME}'!A:K`);
    const appendResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowValues] }),
    });
    if (!appendResp.ok) {
      const details = await appendResp.text();
      return Response.json({ error: 'Failed to append Claude Code row', details }, { status: appendResp.status });
    }

    return Response.json({ success: true, action: 'appended' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});