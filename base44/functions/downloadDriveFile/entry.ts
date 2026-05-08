import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractFolderId(url = '') {
  const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, file_id } = await req.json().catch(() => ({}));

    if (!token || !file_id) {
      return Response.json({ error: 'token and file_id required' }, { status: 400 });
    }

    const projects = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Invalid token' }, { status: 404 });

    const rootFolderId = extractFolderId(project.drive_folder_url);
    if (!rootFolderId) return Response.json({ error: 'Project has no valid Drive folder' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?fields=id,name,mimeType,size,parents`, { headers: authHeader });
    if (!metaRes.ok) return Response.json({ error: 'Drive file not found' }, { status: 404 });
    const file = await metaRes.json();

    let allowed = (file.parents || []).includes(rootFolderId);
    if (!allowed && file.parents?.length) {
      for (const parentId of file.parents) {
        const parentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${parentId}?fields=id,parents,name`, { headers: authHeader });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          if ((parent.parents || []).includes(rootFolderId) && /ערוכות|edited/i.test(parent.name || '')) allowed = true;
        }
      }
    }

    if (!allowed) return Response.json({ error: 'File is not inside this gallery' }, { status: 403 });

    const size = file.size ? parseInt(file.size) : 0;
    if (size > 15 * 1024 * 1024) {
      return Response.json({ error: 'File is too large for direct download' }, { status: 413 });
    }

    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, { headers: authHeader });
    if (!fileRes.ok) return Response.json({ error: 'Failed to fetch file' }, { status: 502 });

    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

    return Response.json({
      name: file.name,
      mime_type: file.mimeType || 'application/octet-stream',
      base64: btoa(binary),
    });
  } catch (error) {
    console.error('downloadDriveFile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});