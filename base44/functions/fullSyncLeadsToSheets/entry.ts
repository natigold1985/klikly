// Full DB → Google Sheets sync.
// Exports all leads from the DB into the correct tab based on source.
// Also sets up headers + data validation (dropdown) for the Status column.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

// Map source values → Sheet tab names
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

// Hebrew headers for the sheet
const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'סטטוס', 'הערות', 'תאריך יצירה'];

// Status values matching the Lead entity
const STATUS_VALUES = ['ליד חדש', 'נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'לא רלוונטי'];

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
  // Fallback by lead_type
  const lt = String(lead.lead_type || '').toLowerCase();
  if (lt.includes('קורס')) return 'מתעניינים בקורס';
  return null; // will only go to "כל הלידים"
}

async function clearAndWriteTab(sheetsAuth, tabName, rows) {
  const encTab = encodeURIComponent(`'${tabName}'`);

  // Clear existing content
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:Z:clear`,
    { method: 'POST', headers: sheetsAuth }
  );

  // Write headers + data
  const allRows = [HEADERS, ...rows];
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A1?valueInputOption=USER_ENTERED`;
  await fetch(updateUrl, {
    method: 'PUT',
    headers: { ...sheetsAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: allRows }),
  });
}

async function setStatusDropdown(sheetsAuth, sheetGid, startRow, endRow) {
  // Add data validation (dropdown) on column F (index 5) for status
  const body = {
    requests: [{
      setDataValidation: {
        range: {
          sheetId: sheetGid,
          startRowIndex: startRow, // 0-based, skip header
          endRowIndex: endRow,
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
    }],
  };

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { ...sheetsAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

    // Fetch all leads
    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 5000);
    console.log(`fullSyncLeadsToSheets: ${allLeads.length} leads`);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const sheetsAuth = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Get sheet metadata (to get sheetId per tab for data validation)
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
    const tabRows = {};
    const allRows = [];

    for (const lead of allLeads) {
      const row = leadToRow(lead);
      allRows.push(row);

      const tab = detectTab(lead);
      if (tab) {
        if (!tabRows[tab]) tabRows[tab] = [];
        tabRows[tab].push(row);
      }
    }

    // Write "🎯 כל הלידים" tab
    await clearAndWriteTab(sheetsAuth, ALL_LEADS_TAB, allRows);
    if (tabGids[ALL_LEADS_TAB]) {
      await setStatusDropdown(sheetsAuth, tabGids[ALL_LEADS_TAB], 1, allRows.length + 1);
    }

    // Write each source tab
    const tabSummary = {};
    for (const [tabName, rows] of Object.entries(tabRows)) {
      if (!tabGids[tabName]) {
        console.log(`fullSyncLeadsToSheets: tab "${tabName}" not found in sheet, skipping`);
        continue;
      }
      await clearAndWriteTab(sheetsAuth, tabName, rows);
      if (tabGids[tabName]) {
        await setStatusDropdown(sheetsAuth, tabGids[tabName], 1, rows.length + 1);
      }
      tabSummary[tabName] = rows.length;
      console.log(`fullSyncLeadsToSheets: wrote ${rows.length} rows to "${tabName}"`);
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'full_sync_leads_to_sheets',
      details: JSON.stringify({ total: allLeads.length, tabs: tabSummary }),
      status: 'success',
    });

    return Response.json({
      success: true,
      total: allLeads.length,
      all_leads_tab: allRows.length,
      tabs: tabSummary,
    });
  } catch (error) {
    console.error('fullSyncLeadsToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});