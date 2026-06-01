import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}/revisions?fields=revisions(id,modifiedTime,keepForever,mimeType,exportLinks,lastModifyingUser(displayName,emailAddress))&pageSize=200`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const details = await res.text();
      return Response.json({ error: 'Failed to list revisions', details }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ success: true, revisions: data.revisions || [] });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});