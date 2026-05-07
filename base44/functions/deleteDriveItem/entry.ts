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

    const { project_id, file_id, delete_project_folder = false, delete_project_record = false } = await req.json().catch(() => ({}));
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    if (project.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = delete_project_folder ? extractFolderId(project.drive_folder_url) : file_id;
    if (!targetId) return Response.json({ error: 'file_id required' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const deleteRes = await fetch(`https://www.googleapis.com/drive/v3/files/${targetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!deleteRes.ok && deleteRes.status !== 404) {
      return Response.json({ error: 'Failed to delete from Drive', details: await deleteRes.text() }, { status: 502 });
    }

    if (delete_project_record) {
      await base44.asServiceRole.entities.Project.delete(project.id);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});