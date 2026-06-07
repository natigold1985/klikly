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

    // Fetch all WhatsApp leads
    const allLeads = await base44.asServiceRole.entities.Lead.filter({ source: 'WhatsApp' }, '-created_date', 2000);
    console.log(`bulkSyncWhatsAppLeadsToSheets: fetched ${allLeads.length} WhatsApp leads`);

    if (allLeads.length === 0) {
      return Response.json({ success: true, appended: 0, skipped: 0 });
    }

    // Get Sheets token
    const sheetsConn = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeader = { Authorization: `Bearer ${sheetsConn.accessToken}` };

    // Fetch existing rows to deduplicate
    const encTab = encodeURIComponent(SHEET_TAB);
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:B`;
    const existingRes = await fetch(getUrl, { headers: authHeader });
    const existingData = await existingRes.json();
    const existingRows = existingData.values || [];

    const existingPhones = new Set(
      existingRows.slice(1).map(row => String(row[1] || '').replace(/[^0-9]/g, '')).filter(Boolean)
    );

    const now = new Date().toLocaleDateString('he-IL');
    const newRows = [];

    for (const lead of allLeads) {
      const phone = String(lead.phone || '').replace(/[^0-9]/g, '');
      if (!phone) continue;
      if (existingPhones.has(phone)) continue;

      const name = lead.name || '';
      const firstName = name.split(' ')[0] || name;
      const waMsg = firstName ? `היי ${firstName}, ` : '';

      newRows.push([name, lead.phone, lead.source || 'WhatsApp', lead.notes || '', waMsg, now]);
      existingPhones.add(phone);
    }

    if (newRows.length === 0) {
      return Response.json({ success: true, appended: 0, skipped: allLeads.length, message: 'All leads already in sheet' });
    }

    // Append in batches of 200
    let totalAppended = 0;
    for (let i = 0; i < newRows.length; i += 200) {
      const batch = newRows.slice(i, i + 200);
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const res = await fetch(appendUrl, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: batch }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('batch append failed:', err);
      } else {
        totalAppended += batch.length;
      }
    }

    console.log(`bulkSyncWhatsAppLeadsToSheets: appended ${totalAppended}, skipped ${allLeads.length - totalAppended}`);
    return Response.json({
      success: true,
      appended: totalAppended,
      skipped: allLeads.length - totalAppended,
      total: allLeads.length,
    });
  } catch (error) {
    console.error('bulkSyncWhatsAppLeadsToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});