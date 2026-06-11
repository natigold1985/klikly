import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const TAB_NAME = 'לידים ביטחון 🎯';
const TAB_GID = 1694943082;

const HEADERS = ['שם מלא', 'תפקיד', 'חברה', 'מייל', 'קישור LinkedIn', 'סטטוס פנייה', 'תאריך בקשת חברות', 'ימים ממתין', 'הערות'];

const STATUS_LABELS = {
  new: 'ליד חדש',
  contacted: 'נשלחה בקשת חברות',
  connected: 'מחובר',
  messaged: 'נשלחה הודעה',
  reviewed: 'נענה',
  dismissed: 'לא רלוונטי',
};

const STATUS_COLOR = {
  new:       { red: 0.85, green: 0.92, blue: 1.0 },
  contacted: { red: 1.0,  green: 0.96, blue: 0.72 },
  connected: { red: 0.78, green: 0.96, blue: 0.80 },
  messaged:  { red: 0.92, green: 0.82, blue: 1.0 },
  reviewed:  { red: 0.70, green: 0.95, blue: 0.75 },
  dismissed: { red: 1.0,  green: 0.83, blue: 0.82 },
};

function daysSince(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Fetch all LinkedIn PotentialLeads
    const allLeads = await base44.asServiceRole.entities.PotentialLead.filter({ platform: 'linkedin' }, '-created_date', 500);

    if (allLeads.length === 0) {
      return Response.json({ success: true, synced: 0, message: 'אין לידים LinkedIn' });
    }

    // Build rows
    const rows = allLeads.map(lead => {
      const titleParts = (lead.title || '').split(' - ');
      const name = titleParts[0] || '';
      const jobTitle = titleParts[1] || '';
      const snippetParts = (lead.snippet || '').split(' - ');
      const company = snippetParts[0] || '';
      const email = (lead.contact_info || '').split('/')[0].trim();
      const contactDateStr = lead.contact_date
        ? new Date(lead.contact_date).toLocaleDateString('he-IL')
        : '';
      const days = daysSince(lead.contact_date);
      return [
        name,
        jobTitle,
        company,
        email,
        lead.source_url || '',
        STATUS_LABELS[lead.status] || lead.status || '',
        contactDateStr,
        days,
        (lead.notes || '').replace(/\n/g, ' | ').slice(0, 200),
      ];
    });

    const encTab = encodeURIComponent(`'${TAB_NAME}'`);

    // Clear sheet
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}:clear`,
      { method: 'POST', headers: authHeader }
    );

    // Write header + data
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ values: [HEADERS, ...rows] }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Sheet write failed: ${err}`);
    }

    // Formatting: freeze, bold header, RTL, row colors
    const totalRows = rows.length + 1;
    const requests = [
      {
        updateSheetProperties: {
          properties: { sheetId: TAB_GID, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      {
        repeatCell: {
          range: { sheetId: TAB_GID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
        },
      },
      {
        repeatCell: {
          range: { sheetId: TAB_GID, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: HEADERS.length },
          cell: {
            userEnteredFormat: {
              textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 } },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment)',
        },
      },
    ];

    // Row color by status
    allLeads.forEach((lead, i) => {
      const color = STATUS_COLOR[lead.status] || STATUS_COLOR['new'];
      requests.push({
        repeatCell: {
          range: { sheetId: TAB_GID, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: 0, endColumnIndex: HEADERS.length },
          cell: { userEnteredFormat: { backgroundColor: color } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    });

    const fmtRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ requests }),
      }
    );

    if (!fmtRes.ok) {
      const err = await fmtRes.text();
      console.warn('Formatting failed (non-fatal):', err);
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'LinkedIn Outreach Sync',
      details: `סנכרנו ${allLeads.length} לידים LinkedIn לגוגל שיטס`,
      status: 'success',
      related_entity_type: 'Lead',
    });

    return Response.json({ success: true, synced: allLeads.length });
  } catch (error) {
    console.error('syncLinkedInOutreachToSheet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});