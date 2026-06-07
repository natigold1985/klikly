import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_TAB = 'WhatsApp';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leads } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return Response.json({ error: 'No leads provided' }, { status: 400 });
    }

    // Get Google Sheets access token
    const sheetsConn = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${sheetsConn.accessToken}` };

    // Fetch existing rows to deduplicate by phone
    const encTab = encodeURIComponent(SHEET_TAB);
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:E`;
    const existingRes = await fetch(getUrl, { headers: authHeader });
    const existingData = await existingRes.json();
    const existingRows = existingData.values || [];

    // Build set of existing phone numbers (column B = index 1)
    const existingPhones = new Set(
      existingRows.slice(1).map(row => String(row[1] || '').replace(/[^0-9]/g, '')).filter(Boolean)
    );

    // Prepare new rows — skip duplicates
    const now = new Date().toLocaleDateString('he-IL');
    const newRows = [];
    for (const lead of leads) {
      const normalizedPhone = String(lead.phone || lead.phone_number || '').replace(/[^0-9]/g, '');
      if (!normalizedPhone) continue;
      if (existingPhones.has(normalizedPhone)) continue;

      const name = lead.name || lead.first_name || '';
      const notes = lead.notes || lead.full_name_notes || '';
      // WhatsApp message template
      const firstName = name.split(' ')[0] || name;
      const waMsg = firstName ? `היי ${firstName}, ` : '';

      newRows.push([name, lead.phone || lead.phone_number, lead.source || 'WhatsApp JONI', notes, waMsg, now]);
      existingPhones.add(normalizedPhone); // avoid intra-batch dups
    }

    if (newRows.length === 0) {
      return Response.json({ success: true, appended: 0, skipped: leads.length });
    }

    // If sheet is empty (no header row), add header first
    const isEmpty = existingRows.length === 0;
    if (isEmpty) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['שם', 'טלפון', 'מקור', 'הערות', 'הודעת וואטסאפ', 'תאריך']] }),
        }
      );
    }

    // Append new rows
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: newRows }),
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      console.error('syncJoniLeadsToSheets: append failed:', err);
      return Response.json({ error: 'Failed to append to sheet: ' + err }, { status: 500 });
    }

    console.log(`syncJoniLeadsToSheets: appended ${newRows.length} rows, skipped ${leads.length - newRows.length}`);

    return Response.json({
      success: true,
      appended: newRows.length,
      skipped: leads.length - newRows.length,
    });
  } catch (error) {
    console.error('syncJoniLeadsToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});