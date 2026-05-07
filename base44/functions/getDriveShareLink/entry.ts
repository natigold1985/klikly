import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractFolderId(url = '') {
  const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, file_id } = await req.json().catch(() => ({}));
    if (!project_id || !file_id) return Response.json({ error: 'project_id and file_id required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (project.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rootFolderId = extractFolderId(project.drive_folder_url);
    if (!rootFolderId) return Response.json({ error: 'Project has no valid Drive folder' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?fields=id,name,webViewLink,parents`, { headers: authHeader });
    if (!fileRes.ok) return Response.json({ error: 'Drive file not found', details: await fileRes.text() }, { status: 404 });
    const file = await fileRes.json();

    const isDirectChild = (file.parents || []).includes(rootFolderId);
    let isNestedChild = false;
    if (!isDirectChild && file.parents?.length) {
      for (const parentId of file.parents) {
        const parentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${parentId}?fields=id,parents`, { headers: authHeader });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          if ((parent.parents || []).includes(rootFolderId)) isNestedChild = true;
        }
      }
    }
    if (!isDirectChild && !isNestedChild) {
      return Response.json({ error: 'File is not inside this project folder' }, { status: 403 });
    }

    await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}/permissions`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return Response.json({ success: true, url: file.webViewLink || `https://drive.google.com/file/d/${file_id}/view`, name: file.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});