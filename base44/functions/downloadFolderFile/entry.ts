import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    if (!size || RAW_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return Response.json({ error: 'File is not deliverable' }, { status: 403 });
    }

    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, { headers: authHeader });
    if (!fileRes.ok || !fileRes.body) return Response.json({ error: 'Failed to fetch file' }, { status: 502 });

    const fileName = safeFileName(file.name || 'studio-gold-file');
    return new Response(fileRes.body, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'X-File-Name': encodeURIComponent(fileName),
      },
    });
  } catch (error) {
    console.error('downloadFolderFile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function safeFileName(name = 'studio-gold-file') {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'studio-gold-file';
}