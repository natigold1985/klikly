import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser(displayName,emailAddress),exportLinks)&pageSize=200`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    const data = await res.json();
    const revisions = (data.revisions || []).map((revision) => ({
      id: revision.id,
      modifiedTime: revision.modifiedTime,
      user: revision.lastModifyingUser?.emailAddress || revision.lastModifyingUser?.displayName || '',
      canExportXlsx: !!revision.exportLinks?.['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    }));
    return Response.json({ success: true, count: revisions.length, recent: revisions.slice(-10) });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});