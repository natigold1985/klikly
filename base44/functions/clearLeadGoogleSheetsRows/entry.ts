import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

function extractSpreadsheetId(sheetUrl) {
  const value = String(sheetUrl || '').trim();
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || DEFAULT_SPREADSHEET_ID;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const spreadsheetId = extractSpreadsheetId(body.sheetUrl);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResp.ok) {
      const details = await metaResp.text();
      return Response.json({ error: 'Failed to read sheet metadata', details }, { status: metaResp.status });
    }

    const metadata = await metaResp.json();
    const requests = [];
    const clearedBySheet = {};

    for (const sheet of metadata.sheets || []) {
      const { sheetId, title, gridProperties } = sheet.properties;
      const rowCount = gridProperties?.rowCount || 0;
      if (rowCount <= 1) {
        clearedBySheet[title] = 0;
        continue;
      }
      requests.push({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: rowCount,
          },
        },
      });
      clearedBySheet[title] = rowCount - 1;
    }

    if (requests.length > 0) {
      const batchResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      if (!batchResp.ok) {
        const details = await batchResp.text();
        return Response.json({ error: 'Failed to clear sheet rows', details }, { status: batchResp.status });
      }
    }

    return Response.json({ success: true, spreadsheetId, clearedTabs: requests.length, clearedBySheet });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});