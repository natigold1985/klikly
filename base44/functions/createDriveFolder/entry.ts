import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Can be called manually with project_id or from entity automation
    const projectId = body.project_id || body.data?.id;
    const projectData = body.data || null;

    if (!projectId) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Get project data if not provided by automation
    let project = projectData;
    if (!project || !project.client_name) {
      const projects = await base44.entities.Project.filter({ id: projectId });
      project = projects[0];
      if (!project) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // Skip if folder already exists
    if (project.drive_folder_url) {
      return Response.json({ success: true, already_exists: true, folder_url: project.drive_folder_url });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Create main project folder — sanitize to prevent URL/garbage in folder name
    const cleanName = (s) => String(s || '').replace(/https?:\/\/\S+/gi, '').replace(/[\\/:*?"<>|]/g, '').trim();
    const safeClient = cleanName(project.client_name) || 'לקוח';
    const safeType = cleanName(project.shooting_type) || 'צילום';
    const safeDate = cleanName(project.shooting_date) || new Date().toISOString().slice(0, 10);
    const folderName = `${safeClient} - ${safeType} - ${safeDate}`;
    
    const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!folderRes.ok) {
      const err = await folderRes.text();
      return Response.json({ error: 'Failed to create folder', details: err }, { status: 500 });
    }

    const folder = await folderRes.json();
    const folderUrl = `https://drive.google.com/drive/folders/${folder.id}`;

    // Create subfolders
    const subfolders = ['גלמים (RAW)', 'ערוכות (Edited)', 'בחירת לקוח', 'חוזים ומסמכים'];
    
    for (const subName of subfolders) {
      await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: subName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folder.id],
        }),
      });
    }

    // Update project with Drive folder URL
    await base44.entities.Project.update(projectId, {
      drive_folder_url: folderUrl,
    });

    return Response.json({
      success: true,
      folder_id: folder.id,
      folder_url: folderUrl,
      folder_name: folderName,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});