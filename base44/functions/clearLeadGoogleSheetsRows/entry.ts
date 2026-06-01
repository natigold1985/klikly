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
    const ranges = [];
    const clearedBySheet = {};

    for (const sheet of metadata.sheets || []) {
      const title = sheet.properties.title;
      ranges.push(`'${title.replace(/'/g, "''")}'!A2:Z10000`);
      clearedBySheet[title] = 'cleared_from_row_2';
    }

    if (ranges.length > 0) {
      const clearResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges }),
      });
      if (!clearResp.ok) {
        const details = await clearResp.text();
        return Response.json({ error: 'Failed to clear sheet values', details }, { status: clearResp.status });
      }
    }

    return Response.json({ success: true, spreadsheetId, clearedTabs: ranges.length, clearedBySheet });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});