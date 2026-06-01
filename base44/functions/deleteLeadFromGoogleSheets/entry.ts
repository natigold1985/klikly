import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function phoneDigits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function rowMatchesLead(row, lead) {
  const rowText = (row || []).join(' ').toLowerCase();
  const leadPhone = phoneDigits(lead.phone || lead.contact_info);
  const leadEmail = normalize(lead.email);
  const leadName = normalize(lead.name || lead.title);
  const leadUrl = normalize(lead.source_post_url || lead.source_url);

  if (leadPhone && (row || []).some((cell) => phoneDigits(cell).includes(leadPhone) || leadPhone.includes(phoneDigits(cell)))) return true;
  if (leadEmail && rowText.includes(leadEmail)) return true;
  if (leadUrl && rowText.includes(leadUrl)) return true;
  if (leadName && leadName.length > 3 && rowText.includes(leadName)) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const lead = payload.data || payload.old_data || payload.lead || {};

    if (!lead || (!lead.phone && !lead.email && !lead.name && !lead.source_post_url && !lead.title && !lead.source_url)) {
      return Response.json({ success: true, deletedRows: 0, reason: 'no_lead_data' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResp.ok) {
      const details = await metaResp.text();
      return Response.json({ error: 'Failed to read sheet metadata', details }, { status: metaResp.status });
    }

    const metadata = await metaResp.json();
    const requests = [];
    const deletedBySheet = {};

    for (const sheet of metadata.sheets || []) {
      const { sheetId, title } = sheet.properties;
      const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:Z2000`);
      const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!valuesResp.ok) continue;

      const valuesData = await valuesResp.json();
      const rows = valuesData.values || [];
      const rowsToDelete = [];
      for (let i = 1; i < rows.length; i++) {
        if (rowMatchesLead(rows[i], lead)) rowsToDelete.push(i);
      }

      deletedBySheet[title] = rowsToDelete.length;
      rowsToDelete.sort((a, b) => b - a).forEach((rowIndex) => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        });
      });
    }

    if (requests.length > 0) {
      const batchResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      if (!batchResp.ok) {
        const details = await batchResp.text();
        return Response.json({ error: 'Failed to delete matching sheet rows', details }, { status: batchResp.status });
      }
    }

    return Response.json({ success: true, deletedRows: requests.length, deletedBySheet });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});