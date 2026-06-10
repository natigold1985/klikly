// Full DB → Google Sheets sync.
// Exports all leads, colors entire rows by status, and sets dropdown validation.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

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

const ALL_LEADS_TAB = '🎯 כל הלידים';
const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'סטטוס', 'הערות', 'תאריך יצירה'];
const STATUS_VALUES = ['ליד חדש', 'נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'לא רלוונטי'];

// RGB background colors per status (for Google Sheets)
const STATUS_ROW_COLORS = {
  'נסגר בהצלחה': { red: 0.714, green: 0.933, blue: 0.714 },  // green
  'לא רלוונטי':  { red: 0.957, green: 0.714, blue: 0.714 },  // red
  'נשלח פולו-אפ':{ red: 0.851, green: 0.773, blue: 0.957 },  // purple
  'נוצר קשר':    { red: 1.0,   green: 0.949, blue: 0.686 },  // yellow
  'נענה':         { red: 1.0,   green: 0.918, blue: 0.686 },  // orange-yellow
  'ליד חדש':     null,                                         // no color (white)
};

function leadToRow(lead) {
  const date = lead.created_date
    ? new Date(lead.created_date).toLocaleDateString('he-IL')
    : '';
  return [
    lead.name || '',
    lead.phone || '',
    lead.email || '',
    lead.source || '',
    lead.shooting_type || lead.lead_type || '',
    lead.status || 'ליד חדש',
    lead.notes || '',
    date,
  ];
}

function detectTab(lead) {
  const src = String(lead.source || '').toLowerCase().trim();
  for (const [key, tab] of Object.entries(SOURCE_TO_TAB)) {
    if (src.includes(key.toLowerCase())) return tab;
  }
  const lt = String(lead.lead_type || '').toLowerCase();
  if (lt.includes('קורס')) return 'מתעניינים בקורס';
  return null;
}

async function clearAndWriteTab(sheetsAuth, tabName, rows) {
  const encTab = encodeURIComponent(`'${tabName}'`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:Z:clear`,
    { method: 'POST', headers: sheetsAuth }
  );
  const allRows = [HEADERS, ...rows];
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A1?valueInputOption=USER_ENTERED`;
  await fetch(updateUrl, {
    method: 'PUT',
    headers: { ...sheetsAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: allRows }),
  });
}

// Color rows + set dropdown validation in one batchUpdate
async function applyFormattingAndValidation(sheetsAuth, sheetGid, leads) {
  const requests = [];

  // Status dropdown on column F (index 5), rows 2..N
  requests.push({
    setDataValidation: {
      range: {
        sheetId: sheetGid,
        startRowIndex: 1,
        endRowIndex: leads.length + 1,
        startColumnIndex: 5,
        endColumnIndex: 6,
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: STATUS_VALUES.map(v => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        strict: true,
      },
    },
  });

  // Row background colors per lead status
  leads.forEach((lead, i) => {
    const status = lead.status || 'ליד חדש';
    const color = STATUS_ROW_COLORS[status];
    if (!color) return; // leave "ליד חדש" white

    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetGid,
          startRowIndex: i + 1, // +1 to skip header
          endRowIndex: i + 2,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: color,
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  });

  if (requests.length === 0) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { ...sheetsAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 5000);
    console.log(`fullSyncLeadsToSheets: ${allLeads.length} leads`);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const sheetsAuth = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const tabGids = {};
    for (const s of (meta.sheets || [])) {
      tabGids[s.properties.title] = s.properties.sheetId;
    }

    // Group leads by tab
    const tabLeads = {};
    const allRows = [];

    for (const lead of allLeads) {
      const row = leadToRow(lead);
      allRows.push(row);
      const tab = detectTab(lead);
      if (tab) {
        if (!tabLeads[tab]) tabLeads[tab] = [];
        tabLeads[tab].push(lead);
      }
    }

    // Write + format "כל הלידים"
    await clearAndWriteTab(sheetsAuth, ALL_LEADS_TAB, allRows);
    if (tabGids[ALL_LEADS_TAB]) {
      await applyFormattingAndValidation(sheetsAuth, tabGids[ALL_LEADS_TAB], allLeads);
    }

    // Write + format each source tab
    const tabSummary = {};
    for (const [tabName, leads] of Object.entries(tabLeads)) {
      if (!tabGids[tabName]) {
        console.log(`fullSyncLeadsToSheets: tab "${tabName}" not found, skipping`);
        continue;
      }
      const rows = leads.map(leadToRow);
      await clearAndWriteTab(sheetsAuth, tabName, rows);
      await applyFormattingAndValidation(sheetsAuth, tabGids[tabName], leads);
      tabSummary[tabName] = leads.length;
      console.log(`fullSyncLeadsToSheets: wrote ${leads.length} rows to "${tabName}"`);
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'full_sync_leads_to_sheets',
      details: JSON.stringify({ total: allLeads.length, tabs: tabSummary }),
      status: 'success',
    });

    return Response.json({ success: true, total: allLeads.length, all_leads_tab: allRows.length, tabs: tabSummary });
  } catch (error) {
    console.error('fullSyncLeadsToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});