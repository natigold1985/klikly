import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_SIZE = 15 * 1024 * 1024;
const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { folder_id, file_id } = await req.json().catch(() => ({}));
    if (!folder_id || !file_id) return Response.json({ error: 'folder_id and file_id required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);
    const project = projects.find((p) => String(p.drive_folder_url || '').includes(folder_id));
    if (!project) return Response.json({ error: 'Gallery not found' }, { status: 404 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?fields=id,name,mimeType,size,parents`, { headers: authHeader });
    if (!metaRes.ok) return Response.json({ error: 'Drive file not found' }, { status: 404 });
    const file = await metaRes.json();

    const size = Number(file.size || 0);
    const name = String(file.name || '').toLowerCase();
    if (!size || size > MAX_SIZE || RAW_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return Response.json({ error: 'File is not deliverable' }, { status: 403 });
    }

    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, { headers: authHeader });
    if (!fileRes.ok) return Response.json({ error: 'Failed to fetch file' }, { status: 502 });

    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

    return Response.json({ name: file.name, mime_type: file.mimeType || 'application/octet-stream', base64: btoa(binary) });
  } catch (error) {
    console.error('downloadFolderFile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});