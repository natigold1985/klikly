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
  'course lead': 'מתעניינים בקורס',
  'קורס': 'מתעניינים בקורס',
  'claude code': 'Claude Code',
  'claude': 'Claude Code',
};

const ALL_LEADS_TAB = '🎯 כל הלידים';
const HEADERS = ['שם מלא', 'טלפון', 'מייל', 'מקור', 'שירות / עניין', 'סטטוס', 'התקדמות', 'הערות'];

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
const STATUS_VALUES = ['חדש מהאתר', 'בטיפול מהאתר', 'נסגר מהאתר', 'ליד חדש', 'נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'לא רלוונטי'];

function isWebsiteLead(lead) {
  const text = `${lead?.source || ''} ${lead?.source_post_url || ''}`.toLowerCase();
  return text.includes('natigold.com') || text.includes('אתר') || text.includes('website');
}

function sheetStatus(lead) {
  if (!isWebsiteLead(lead)) return lead.status || 'ליד חדש';
  if (lead.status === 'נסגר בהצלחה') return 'נסגר מהאתר';
  if (lead.status === 'לא רלוונטי') return 'לא רלוונטי';
  if (lead.status && lead.status !== 'ליד חדש') return 'בטיפול מהאתר';
  return 'חדש מהאתר';
}

// Sort order: new website leads first, then active work, then regular new, closed at bottom
const STATUS_SORT_ORDER = {
  'חדש מהאתר':      0,
  'בטיפול מהאתר':   1,
  'נוצר קשר':       2,
  'נשלח פולו-אפ':   3,
  'נענה':           4,
  'ליד חדש':        5,
  'נסגר מהאתר':     6,
  'נסגר בהצלחה':    7,
  'לא רלוונטי':     8,
};

function sortLeadsByStatus(leads) {
  return [...leads].sort((a, b) => {
    const aOrder = STATUS_SORT_ORDER[sheetStatus(a)] ?? 5;
    const bOrder = STATUS_SORT_ORDER[sheetStatus(b)] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_date || 0) - new Date(a.created_date || 0);
  });
}

// RGB background colors per status (for Google Sheets) — matches KLIKLY UI colors exactly
const STATUS_ROW_COLORS = {
  'חדש מהאתר':      { red: 0.820, green: 0.906, blue: 0.980 },  // blue-100
  'בטיפול מהאתר':   { red: 0.996, green: 0.973, blue: 0.714 },  // yellow-200
  'נסגר מהאתר':     { red: 0.776, green: 0.937, blue: 0.776 },  // green-200
  'ליד חדש':        { red: 0.820, green: 0.906, blue: 0.980 },  // blue-100
  'נוצר קשר':       { red: 0.996, green: 0.973, blue: 0.714 },  // yellow-200
  'נשלח פולו-אפ':   { red: 0.906, green: 0.824, blue: 0.992 },  // purple-200
  'נענה':           { red: 1.0,   green: 0.953, blue: 0.784 },  // yellow-100
  'נסגר בהצלחה':    { red: 0.776, green: 0.937, blue: 0.776 },  // green-200
  'לא רלוונטי':     { red: 0.992, green: 0.808, blue: 0.808 },  // red-200
};

const APP_BASE_URL = 'https://klikly.base44.app';

function leadToRow(lead) {
  const nameLink = lead.id
    ? `=HYPERLINK("${APP_BASE_URL}/LeadDetails?id=${lead.id}","${(lead.name || '').replace(/"/g, '""')}")`
    : (lead.name || '');
  const stage = lead.pipeline_stage
    ? (PIPELINE_STAGE_LABELS[lead.pipeline_stage] || lead.pipeline_stage)
    : '';
  return [
    nameLink,
    lead.phone ? `'${lead.phone}` : '',
    lead.email || '',
    lead.source || '',
    lead.shooting_type || lead.lead_type || '',
    sheetStatus(lead),
    stage,
    lead.notes || '',
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

  // Style header row (index 0) — Claude-inspired warm orange background with black text
  const isClaude = tabName.toLowerCase().includes('claude');
  const headerBgColor = isClaude
    ? { red: 0.95, green: 0.68, blue: 0.42 }  // Warm orange (#F2AD6D) for Claude
    : { red: 0.1, green: 0.1, blue: 0.1 };     // Dark gray for others
  
  const headerTextColor = isClaude
    ? { red: 0.1, green: 0.1, blue: 0.1 }   // Black text for Claude
    : { red: 1.0, green: 1.0, blue: 1.0 };   // White text for others
  
  requests.push({
    repeatCell: {
      range: {
        sheetId: sheetGid,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 8,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: headerBgColor,
          textFormat: {
            bold: true,
            fontSize: 12,
            foregroundColor: headerTextColor,
          },
          horizontalAlignment: 'CENTER',
          textDirection: 'RIGHT_TO_LEFT',
        },
      },
      fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.textDirection',
    },
  });

  // Claude Code tab: add light orange/peach background to data rows
  if (isClaude) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: sheetGid,
          startRowIndex: 1,
          endRowIndex: leads.length + 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.98, green: 0.90, blue: 0.80 }, // Light peach (#FAE5CC) for rows
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  // Right-align + RTL text direction for ALL data cells (rows 1..N+1, all columns)
  requests.push({
    repeatCell: {
      range: {
        sheetId: sheetGid,
        startRowIndex: 0,
        endRowIndex: leads.length + 1,
        startColumnIndex: 0,
        endColumnIndex: 8,
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

  // Row background colors + black text per lead status
  leads.forEach((lead, i) => {
    const status = sheetStatus(lead);
    const color = STATUS_ROW_COLORS[status] || { red: 1.0, green: 1.0, blue: 1.0 };

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
            textFormat: {
              foregroundColor: { red: 0, green: 0, blue: 0 }, // always black text
              bold: false,
            },
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold',
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

    for (const lead of allLeads) {
      const tab = detectTab(lead);
      if (tab) {
        if (!tabLeads[tab]) tabLeads[tab] = [];
        tabLeads[tab].push(lead);
      }
    }

    // Sort all leads by status before writing to "כל הלידים"
    const sortedAllLeads = sortLeadsByStatus(allLeads);
    const allRows = sortedAllLeads.map(leadToRow);

    // Write + format "כל הלידים"
    await clearAndWriteTab(sheetsAuth, ALL_LEADS_TAB, allRows);
    if (tabGids[ALL_LEADS_TAB]) {
      await applyFormattingAndValidation(sheetsAuth, tabGids[ALL_LEADS_TAB], sortedAllLeads, ALL_LEADS_TAB);
    }

    // Write + format each source tab (sorted by status)
    const tabSummary = {};
    for (const [tabName, leads] of Object.entries(tabLeads)) {
      if (!tabGids[tabName]) {
        console.log(`fullSyncLeadsToSheets: tab "${tabName}" not found, skipping`);
        continue;
      }
      const sortedLeads = sortLeadsByStatus(leads);
      const rows = sortedLeads.map(leadToRow);
      await clearAndWriteTab(sheetsAuth, tabName, rows);
      await applyFormattingAndValidation(sheetsAuth, tabGids[tabName], sortedLeads, tabName);
      tabSummary[tabName] = sortedLeads.length;
      console.log(`fullSyncLeadsToSheets: wrote ${sortedLeads.length} rows to "${tabName}"`);
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