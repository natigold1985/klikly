// Upserts a Lead into Google Sheets: updates existing rows instead of creating duplicates.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const ALL_LEADS_TAB = '🎯 כל הלידים';
const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'סטטוס', 'התקדמות', 'הערות'];

const SOURCE_TO_TAB = {
  whatsapp: 'WhatsApp',
  'whatsapp leads': 'WhatsApp',
  'natigold.com (אתר)': 'לידים מהאתר',
  'natigold.com': 'לידים מהאתר',
  website: 'לידים מהאתר',
  instagram: 'אינסטגרם — מענה ופולו-אפ',
  facebook: 'לידים ביטחון 🎯',
  'defense industry': 'לידים ביטחון 🎯',
  'course lead': 'מתעניינים בקורס',
  'קורס': 'מתעניינים בקורס',
};

const PIPELINE_STAGE_LABELS = {
  lead_found: 'ליד נמצא',
  outreach: 'פנייה ראשונית',
  procurement_check: 'בדיקת רכש',
  contract_closed: 'חוזה נסגר',
  quote_sent: 'הצעת מחיר נשלחה',
  follow_up: 'פולו-אפ',
  logistics_coordination: 'תיאום לוגיסטי',
  completed: 'הושלם',
  registered_webinar: 'נרשם לוובינר',
  watched_webinar: 'צפה בוובינר',
  consultation_meeting: 'פגישת ייעוץ',
};

function detectTab(lead) {
  const src = String(lead.source || '').toLowerCase().trim();
  for (const [key, tab] of Object.entries(SOURCE_TO_TAB)) {
    if (src.includes(key.toLowerCase())) return tab;
  }
  const lt = String(lead.lead_type || '').toLowerCase();
  if (lt.includes('קורס')) return 'מתעניינים בקורס';
  return null;
}

function phoneDigits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRow(lead) {
  const sourceUrl = lead.source_post_url ? `קישור מקור: ${lead.source_post_url}` : '';
  const notes = [lead.notes, sourceUrl].filter(Boolean).join(' | ');
  const stage = lead.pipeline_stage ? (PIPELINE_STAGE_LABELS[lead.pipeline_stage] || lead.pipeline_stage) : '';
  return [
    lead.name || '',
    lead.phone ? `'${lead.phone}` : '',
    lead.email || '',
    lead.source || '',
    lead.shooting_type || lead.lead_type || '',
    lead.status || 'ליד חדש',
    stage,
    notes,
  ];
}

function rowMatchesLead(row, lead) {
  if (!lead) return false;
  const rowText = (row || []).join(' ').toLowerCase();
  const leadPhone = phoneDigits(lead.phone || lead.contact_info);
  const leadEmail = normalize(lead.email);
  const leadName = normalize(lead.name || lead.title);
  const leadUrl = normalize(lead.source_post_url || lead.source_url);

  if (leadPhone && (row || []).some((cell) => {
    const d = phoneDigits(cell);
    return d && (d.includes(leadPhone) || leadPhone.includes(d));
  })) return true;
  if (leadEmail && rowText.includes(leadEmail)) return true;
  if (leadUrl && rowText.includes(leadUrl)) return true;
  if (leadName && leadName.length > 3 && rowText.includes(leadName)) return true;
  return false;
}

async function ensureHeaders(authHeader, tabName) {
  const headerRange = encodeURIComponent(`'${tabName}'!A1:H1`);
  const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${headerRange}`, { headers: authHeader });
  const checkData = await checkRes.json();
  if ((checkData.values || []).length > 0) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [HEADERS] }),
  });
}

async function deleteExistingRows(authHeader, tabs, lead, oldLead) {
  const uniqueTabs = [...new Set(tabs.filter(Boolean))];
  if (!uniqueTabs.length) return 0;

  const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`, { headers: authHeader });
  if (!metaResp.ok) return 0;
  const meta = await metaResp.json();
  const sheetByTitle = {};
  for (const sheet of (meta.sheets || [])) sheetByTitle[sheet.properties.title] = sheet.properties.sheetId;

  const ranges = uniqueTabs.map((tab) => `ranges=${encodeURIComponent(`'${tab}'!A1:Z3000`)}`).join('&');
  const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${ranges}`, { headers: authHeader });
  if (!valuesResp.ok) return 0;
  const valuesData = await valuesResp.json();

  const requests = [];
  for (let t = 0; t < uniqueTabs.length; t++) {
    const tabName = uniqueTabs[t];
    const sheetId = sheetByTitle[tabName];
    if (sheetId === undefined) continue;
    const rows = valuesData.valueRanges?.[t]?.values || [];
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rowMatchesLead(rows[i], lead) || rowMatchesLead(rows[i], oldLead)) {
        requests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } });
      }
    }
  }

  if (!requests.length) return 0;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  return requests.length;
}

async function appendRow(authHeader, tabName, row) {
  await ensureHeaders(authHeader, tabName);
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${tabName}'!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!appendRes.ok) console.error(`pushLeadToSheet: append to "${tabName}" failed:`, await appendRes.text());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const lead = payload.data || payload.lead;
    const oldLead = payload.old_data || null;

    if (!lead || !lead.name) return Response.json({ success: true, skipped: 'no_lead_data' });

    const phone = phoneDigits(lead.phone);
    const hasPhone = phone.length >= 9;
    const hasEmail = !!(lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email).trim()));
    if (!hasPhone && !hasEmail) return Response.json({ success: true, skipped: 'no_contact_info' });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    const sourceTab = detectTab(lead);
    const oldSourceTab = detectTab(oldLead || {});
    const targetTabs = [ALL_LEADS_TAB, sourceTab, oldSourceTab].filter(Boolean);
    const deletedRows = await deleteExistingRows(authHeader, targetTabs, lead, oldLead);

    const row = buildRow(lead);
    await appendRow(authHeader, ALL_LEADS_TAB, row);
    if (sourceTab) await appendRow(authHeader, sourceTab, row);

    return Response.json({ success: true, lead: lead.name, deletedRows, tabs: [ALL_LEADS_TAB, sourceTab].filter(Boolean) });
  } catch (error) {
    console.error('pushLeadToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});