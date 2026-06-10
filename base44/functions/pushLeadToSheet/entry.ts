// Writes a single new lead to the "🎯 כל הלידים" tab in Google Sheets.
// Called by the entity automation on Lead create.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const SHEET_TAB = '🎯 כל הלידים';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const lead = payload.data;

    if (!lead || !lead.name) {
      return Response.json({ success: true, skipped: 'no_lead_data' });
    }

    // Skip if no valid phone/email (junk lead)
    const phoneDigits = String(lead.phone || '').replace(/[^0-9]/g, '');
    const hasPhone = phoneDigits.length >= 9;
    const hasEmail = !!(lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email));
    if (!hasPhone && !hasEmail) {
      return Response.json({ success: true, skipped: 'no_contact_info' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Ensure headers exist — fetch first 2 rows
    const encTab = encodeURIComponent(`'${SHEET_TAB}'!A1:H2`);
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}`,
      { headers: authHeader }
    );
    const checkData = await checkRes.json();
    const hasHeaders = (checkData.values || []).length > 0;

    if (!hasHeaders) {
      // Write header row first
      const headerRange = encodeURIComponent(`'${SHEET_TAB}'!A1:H1`);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['שם', 'טלפון', 'מייל', 'מקור', 'שירות', 'עמוד מקור', 'סטטוס', 'תאריך']] }),
        }
      );
    }

    // Build the row
    const now = new Date().toLocaleDateString('he-IL');
    const row = [
      lead.name || '',
      lead.phone || '',
      lead.email || '',
      lead.source || '',
      lead.shooting_type || '',
      lead.source_post_url || '',
      lead.status || 'ליד חדש',
      now,
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${SHEET_TAB}'!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      console.error('pushLeadToSheet: append failed:', err);
      return Response.json({ success: false, error: err }, { status: 500 });
    }

    return Response.json({ success: true, lead: lead.name });
  } catch (error) {
    console.error('pushLeadToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});