// Writes a single new lead to "🎯 כל הלידים" AND to the relevant source tab (e.g. WhatsApp).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const ALL_LEADS_TAB = '🎯 כל הלידים';

const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'עמוד מקור', 'סטטוס', 'תאריך יצירה'];

const SOURCE_TO_TAB = {
  whatsapp: 'WhatsApp',
  'whatsapp leads': 'WhatsApp',
  'natigold.com (אתר)': 'לידים מהאתר',
  'natigold.com': 'לידים מהאתר',
  instagram: 'אינסטגרם — מענה ופולו-אפ',
  facebook: 'לידים ביטחון 🎯',
  'defense industry': 'לידים ביטחון 🎯',
  linkedin: 'לידים ביטחון 🎯',
  'course lead': 'מתעניינים בקורס',
  'קורס': 'מתעניינים בקורס',
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

function buildRow(lead) {
  const now = new Date().toLocaleDateString('he-IL');
  return [
    lead.name || '',
    lead.phone || '',
    lead.email || '',
    lead.source || '',
    lead.shooting_type || lead.lead_type || '',
    lead.source_post_url || '',
    lead.status || 'ליד חדש',
    now,
  ];
}

async function ensureHeadersAndAppend(authHeader, tabName, row) {
  const encTab = encodeURIComponent(`'${tabName}'!A1:H2`);
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}`,
    { headers: authHeader }
  );
  const checkData = await checkRes.json();
  const hasHeaders = (checkData.values || []).length > 0;

  if (!hasHeaders) {
    const headerRange = encodeURIComponent(`'${tabName}'!A1:H1`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [HEADERS] }),
      }
    );
  }

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${tabName}'!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });

  if (!appendRes.ok) {
    const err = await appendRes.text();
    console.error(`pushLeadToSheet: append to "${tabName}" failed:`, err);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const lead = payload.data;

    if (!lead || !lead.name) {
      return Response.json({ success: true, skipped: 'no_lead_data' });
    }

    // Skip junk leads
    const phoneDigits = String(lead.phone || '').replace(/[^0-9]/g, '');
    const hasPhone = phoneDigits.length >= 9;
    const hasEmail = !!(lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email));
    if (!hasPhone && !hasEmail) {
      return Response.json({ success: true, skipped: 'no_contact_info' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    const row = buildRow(lead);
    const sourceTab = detectTab(lead);

    // Always write to "כל הלידים"
    await ensureHeadersAndAppend(authHeader, ALL_LEADS_TAB, row);

    // Also write to source-specific tab (e.g. WhatsApp)
    if (sourceTab) {
      await ensureHeadersAndAppend(authHeader, sourceTab, row);
    }

    return Response.json({ success: true, lead: lead.name, tabs: [ALL_LEADS_TAB, sourceTab].filter(Boolean) });
  } catch (error) {
    console.error('pushLeadToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});