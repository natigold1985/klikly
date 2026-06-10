import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

function phoneDigits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function rowMatchesLead(row, lead) {
  const rowText = (row || []).join(' ').toLowerCase();
  const leadPhone = phoneDigits(lead.phone || lead.contact_info);
  const leadEmail = normalize(lead.email);
  const leadName = normalize(lead.name || lead.title);
  const leadUrl = normalize(lead.source_post_url || lead.source_url);

  if (leadPhone && (row || []).some((cell) => {
    const d = phoneDigits(cell);
    return d && (d.includes(leadPhone) || leadPhone.includes(d));
  })) return true;
  if (leadEmail && rowText.includes(leadEmail)) return true;
  if (leadUrl && rowText.includes(leadUrl)) return true;
  if (leadName && leadName.length > 3 && rowText.includes(leadName)) return true;
  return false;
}

// Fetch with exponential backoff for 429 rate-limit errors
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status !== 429) return resp;
    if (attempt === maxRetries) return resp;
    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 1s, 2s, 4s + jitter
    console.log(`deleteLeadFromGoogleSheets: 429 received, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, delay));
  }
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
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Step 1: Get all tab names (1 read request)
    const metaResp = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: authHeader }
    );
    if (!metaResp.ok) {
      const details = await metaResp.text();
      return Response.json({ error: 'Failed to read sheet metadata', details }, { status: metaResp.status });
    }
    const metadata = await metaResp.json();
    const sheets = metadata.sheets || [];

    // Step 2: Fetch ALL tabs in ONE batchGet request (1 read request instead of N)
    const ranges = sheets.map(s => `'${s.properties.title.replace(/'/g, "''")}'!A1:Z2000`);
    const rangesQuery = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const batchGetResp = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${rangesQuery}`,
      { headers: authHeader }
    );
    if (!batchGetResp.ok) {
      const details = await batchGetResp.text();
      return Response.json({ error: 'Failed to read sheet values', details }, { status: batchGetResp.status });
    }
    const batchData = await batchGetResp.json();
    const valueRanges = batchData.valueRanges || [];

    // Step 3: Find rows to delete across all tabs
    const deleteRequests = [];
    const deletedBySheet = {};

    for (let t = 0; t < sheets.length; t++) {
      const { sheetId, title } = sheets[t].properties;
      const rows = valueRanges[t]?.values || [];
      const rowsToDelete = [];

      for (let i = 1; i < rows.length; i++) {
        if (rowMatchesLead(rows[i], lead)) rowsToDelete.push(i);
      }

      deletedBySheet[title] = rowsToDelete.length;
      // Sort descending so row indices stay valid as we delete
      rowsToDelete.sort((a, b) => b - a).forEach((rowIndex) => {
        deleteRequests.push({
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        });
      });
    }

    // Step 4: Delete matching rows in one batchUpdate
    if (deleteRequests.length > 0) {
      const batchUpdateResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: deleteRequests }),
        }
      );
      if (!batchUpdateResp.ok) {
        const details = await batchUpdateResp.text();
        return Response.json({ error: 'Failed to delete matching sheet rows', details }, { status: batchUpdateResp.status });
      }
    }

    return Response.json({ success: true, deletedRows: deleteRequests.length, deletedBySheet });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});