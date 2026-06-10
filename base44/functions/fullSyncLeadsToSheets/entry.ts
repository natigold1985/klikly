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
  'claude code': 'Claude Code',
  'claude': 'Claude Code',
};

const ALL_LEADS_TAB = '🎯 כל הלידים';
const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'סטטוס', 'התקדמות', 'הערות', 'תאריך יצירה'];

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
const STATUS_VALUES = ['ליד חדש', 'נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'לא רלוונטי'];

// RGB background colors per status (for Google Sheets) — matches KLIKLY UI colors exactly
const STATUS_ROW_COLORS = {
  'ליד חדש':     { red: 0.820, green: 0.906, blue: 0.980 },  // blue-100  (matches KLIKLY כחול)
  'נוצר קשר':    { red: 0.996, green: 0.973, blue: 0.714 },  // yellow-200 (matches KLIKLY צהוב)
  'נשלח פולו-אפ':{ red: 0.906, green: 0.824, blue: 0.992 },  // purple-200 (matches KLIKLY סגול)
  'נענה':         { red: 1.0,   green: 0.953, blue: 0.784 },  // yellow-100 lighter (matches KLIKLY כתום-צהוב)
  'נסגר בהצלחה': { red: 0.776, green: 0.937, blue: 0.776 },  // green-200  (matches KLIKLY ירוק)
  'לא רלוונטי':  { red: 0.992, green: 0.808, blue: 0.808 },  // red-200    (matches KLIKLY אדום)
};

const APP_BASE_URL = 'https://klikly.base44.app';

function leadToRow(lead) {
  const date = lead.created_date
    ? new Date(lead.created_date).toLocaleDateString('he-IL')
    : '';
  const nameLink = lead.id
    ? `=HYPERLINK("${APP_BASE_URL}/LeadDetails?id=${lead.id}","${(lead.name || '').replace(/"/g, '""')}")`
    : (lead.name || '');
  const stage = lead.pipeline_stage
    ? (PIPELINE_STAGE_LABELS[lead.pipeline_stage] || lead.pipeline_stage)
    : '';
  return [
    nameLink,
    lead.phone || '',
    lead.email || '',
    lead.source || '',
    lead.shooting_type || lead.lead_type || '',
    lead.status || 'ליד חדש',
    stage,
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

// Color rows + set dropdown validation + RTL in one batchUpdate
async function applyFormattingAndValidation(sheetsAuth, sheetGid, leads, tabName = '') {
  const requests = [];

  // Freeze first column (שם מלא) + header row + set RTL direction
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: sheetGid,
        gridProperties: {
          frozenRowCount: 1,
          frozenColumnCount: 1,
        },
        rightToLeft: true,
      },
      fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount,rightToLeft',
    },
  });

  // Style header row (index 0) — bold, dark background, white text
  const headerBgColor = tabName.toLowerCase().includes('claude') 
    ? { red: 0.2, green: 0.2, blue: 0.3 }  // Dark navy-blue for Claude Code
    : { red: 0.1, green: 0.1, blue: 0.1 }; // Dark gray for others
  
  requests.push({
    repeatCell: {
      range: {
        sheetId: sheetGid,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 9,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: headerBgColor,
          textFormat: {
            bold: true,
            fontSize: 12,
            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, // White text
          },
          horizontalAlignment: 'CENTER',
          textDirection: 'RIGHT_TO_LEFT',
        },
      },
      fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.textDirection',
    },
  });

  // Right-align + RTL text direction for ALL data cells (rows 1..N+1, all columns)
  requests.push({
    repeatCell: {
      range: {
        sheetId: sheetGid,
        startRowIndex: 0,
        endRowIndex: leads.length + 1,
        startColumnIndex: 0,
        endColumnIndex: 9,
      },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'RIGHT',
          textDirection: 'RIGHT_TO_LEFT',
        },
      },
      fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.textDirection',
    },
  });

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
          endColumnIndex: 9,
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

// Force RTL on ALL tabs in the spreadsheet at once
async function forceRtlAllTabs(sheetsAuth, allTabGids) {
  const requests = Object.values(allTabGids).map(gid => ({
    updateSheetProperties: {
      properties: {
        sheetId: gid,
        rightToLeft: true,
      },
      fields: 'rightToLeft',
    },
  }));
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

    // Force RTL on ALL tabs first (including WhatsApp and any other tab)
    await forceRtlAllTabs(sheetsAuth, tabGids);
    console.log(`fullSyncLeadsToSheets: RTL applied to ${Object.keys(tabGids).length} tabs`);

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
      await applyFormattingAndValidation(sheetsAuth, tabGids[ALL_LEADS_TAB], allLeads, ALL_LEADS_TAB);
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
      await applyFormattingAndValidation(sheetsAuth, tabGids[tabName], leads, tabName);
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