import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const revisionId = body.revisionId || '182';
    const sheetContains = String(body.sheetContains || 'ביטחון').toLowerCase();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const exportResp = await fetch(`https://docs.google.com/spreadsheets/export?id=${SPREADSHEET_ID}&revision=${revisionId}&exportFormat=xlsx`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!exportResp.ok) return Response.json({ error: await exportResp.text() }, { status: exportResp.status });
    const workbook = XLSX.read(await exportResp.arrayBuffer(), { type: 'array' });
    const sheets = workbook.SheetNames.filter((name) => name.toLowerCase().includes(sheetContains));
    const result = {};
    for (const sheetName of sheets) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
      result[sheetName] = rows.slice(0, 25);
    }
    return Response.json({ success: true, revisionId, sheets, result });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});