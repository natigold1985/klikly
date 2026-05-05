// Lists files from a project's Google Drive folder.
// Used by both photographer (FileStorage) and client (MagicGallery via token).
// Zero-cost: files stay in photographer's Drive; we only return metadata + thumbnail links.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { project_id, token } = body;

    let project = null;
    let isClient = false;

    // Two access modes:
    // A) Authenticated photographer/admin (project_id)
    // B) Public via Magic Link token (no auth required)
    if (token) {
      const list = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
      project = list[0];
      isClient = true;
      if (!project) return Response.json({ error: 'Invalid link' }, { status: 404 });
    } else {
      const me = await base44.auth.me();
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
      const list = await base44.asServiceRole.entities.Project.filter({ id: project_id });
      project = list[0];
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      // Authorize: owner or admin
      if (project.created_by !== me.email && me.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!project.drive_folder_url) {
      return Response.json({ project: serializeProject(project, isClient), files: [], folder_missing: true });
    }

    // Extract folder ID from URL
    const match = project.drive_folder_url.match(/folders\/([a-zA-Z0-9_-]+)/);
    const folderId = match?.[1];
    if (!folderId) {
      return Response.json({ project: serializeProject(project, isClient), files: [], folder_missing: true });
    }

    // Use the photographer's Drive connection (project owner)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // Fetch files in folder (and "Edited" subfolder if it exists, recursively one level)
    const allFiles = [];
    await fetchFolderFiles(accessToken, folderId, allFiles);

    // For client view, only return files from "Edited / ערוכות" subfolder if they exist —
    // otherwise show all (photographer might be using a flat structure).
    let visible = allFiles;
    if (isClient) {
      const editedOnly = allFiles.filter(f => /ערוכות|edited/i.test(f.parent_name || ''));
      if (editedOnly.length > 0) visible = editedOnly;
    }

    // Map to client-friendly shape
    const files = visible
      .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
      .map(f => ({
        id: f.id,
        name: f.name,
        mime_type: f.mimeType,
        size: f.size ? parseInt(f.size) : 0,
        thumbnail_url: f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+/, '=s1600') : null,
        view_url: f.webViewLink,
        download_url: `https://drive.google.com/uc?export=download&id=${f.id}`,
        is_video: (f.mimeType || '').startsWith('video/'),
        is_image: (f.mimeType || '').startsWith('image/'),
        video_duration_ms: f.videoMediaMetadata?.durationMillis ? parseInt(f.videoMediaMetadata.durationMillis) : null,
        modified_time: f.modifiedTime,
      }));

    return Response.json({
      project: serializeProject(project, isClient),
      files,
    });
  } catch (error) {
    console.error('listDriveFiles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function serializeProject(p, isClient) {
  const base = {
    id: p.id,
    client_name: p.client_name,
    shooting_type: p.shooting_type,
    shooting_date: p.shooting_date,
    drive_folder_url: p.drive_folder_url,
  };
  if (!isClient) {
    base.client_access_token = p.client_access_token;
    base.client_email = p.client_email;
  }
  return base;
}

async function fetchFolderFiles(accessToken, folderId, out, parentName = '') {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,thumbnailLink,hasThumbnail,webViewLink,webContentLink,videoMediaMetadata,modifiedTime)&pageSize=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    console.error('Drive list failed', await res.text());
    return;
  }
  const data = await res.json();
  for (const f of data.files || []) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      // Recurse one level into subfolders
      await fetchFolderFiles(accessToken, f.id, out, f.name);
    } else {
      out.push({ ...f, parent_name: parentName });
    }
  }
}