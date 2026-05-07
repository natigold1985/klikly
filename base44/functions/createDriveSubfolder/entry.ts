import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractFolderId(url = '') {
  const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

function cleanFolderName(name = '') {
  return String(name).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, folder_name } = await req.json().catch(() => ({}));
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    const name = cleanFolderName(folder_name);
    if (!name) return Response.json({ error: 'folder_name required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parentId = extractFolderId(project.drive_folder_url);
    if (!parentId) return Response.json({ error: 'Project has no valid Drive folder' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const query = encodeURIComponent(`'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
    const existingRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`, { headers });
    const existing = await existingRes.json();
    if (existing.files?.[0]) {
      return Response.json({ success: true, already_exists: true, folder: existing.files[0] });
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });

    if (!createRes.ok) {
      return Response.json({ error: 'Failed to create Drive folder', details: await createRes.text() }, { status: 502 });
    }

    const folder = await createRes.json();
    return Response.json({ success: true, folder });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});