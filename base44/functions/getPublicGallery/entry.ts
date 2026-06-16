import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId, pin } = await req.json();

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    const currentUser = await getCurrentUser(base44);
    const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'natigold04@gmail.com';

    const clientEmails = [
      project?.client_email,
      ...(Array.isArray(project?.client_emails) ? project.client_emails : [])
    ].filter(Boolean).map(e => e.toLowerCase());
    const isProjectClient = !!currentUser?.email && clientEmails.includes(currentUser.email.toLowerCase());

    if (project?.gallery_requires_payment && project.payment_status !== 'paid' && !isAdmin) {
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'selection_gallery_payment_blocked',
        details: `[402 Payment Required] Gallery blocked until payment (Project ID: ${projectId}).`,
        status: 'pending',
        related_entity_type: 'Project',
        related_entity_id: projectId,
        owner_id: project.created_by || null
      }).catch(() => {});
      return Response.json({ error: 'הגלריה זמינה רק לאחר תשלום' }, { status: 402 });
    }

    const hasValidPin = String(project?.gallery_pin || '').trim() && String(project.gallery_pin).trim() === String(pin || '').trim();
    const hasDirectProjectLink = !!project?.drive_folder_url;
    if (!project || (!isAdmin && !isProjectClient && !hasValidPin && !hasDirectProjectLink)) {
      // BOLA Protection & Security Logging
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'security_violation',
        details: `[403 Access Denied] Unauthorized access attempt to Gallery (Project ID: ${projectId}) with invalid PIN.`,
        status: 'error',
        owner_id: project ? project.created_by : null
      });
      return Response.json({ error: 'קוד אישי שגוי או פרויקט לא נמצא' }, { status: 403 });
    }

    const driveFiles = await listProjectDriveFiles(base44, project);
    const savedPhotos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId }).catch(() => []);
    const savedByDriveId = new Map(savedPhotos.filter((photo) => photo.drive_file_id).map((photo) => [photo.drive_file_id, photo]));
    const photos = driveFiles.map((file, index) => {
      const saved = savedByDriveId.get(file.id) || {};
      return {
        id: file.id,
        drive_file_id: file.id,
        name: file.name,
        file_name: file.name,
        order_index: index + 1,
        url: file.thumbnail_url || file.view_url,
        thumbnail: file.thumbnail_url,
        thumbnail_url: file.thumbnail_url,
        download_url: file.download_url,
        view_url: file.view_url,
        is_selected: saved.is_selected || false,
        client_comment: saved.client_comment || '',
        editing_status: saved.editing_status || 'finalized'
      };
    });

    return Response.json({
        project: {
            id: project.id,
            client_name: project.client_name,
            shooting_type: project.shooting_type,
            shooting_date: project.shooting_date
        },
        photos 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getCurrentUser(base44) {
  try {
    return await base44.auth.me();
  } catch (_) {
    return null;
  }
}

async function listProjectDriveFiles(base44, project) {
  if (!project?.drive_folder_url) return [];
  const match = project.drive_folder_url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  const folderId = match?.[1];
  if (!folderId) return [];

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
  const allFiles = [];
  await fetchFolderFiles(accessToken, folderId, allFiles);
  const editedOnly = allFiles.filter((f) => /ערוכות|edited/i.test(f.parent_name || ''));
  const visible = editedOnly.length > 0 ? editedOnly : allFiles;

  return visible
    .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
    .filter((f) => (f.mimeType || '').startsWith('image/'))
    .map((f) => ({
      id: f.id,
      name: f.name,
      thumbnail_url: f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+/, '=s1600') : null,
      view_url: f.webViewLink,
      download_url: `https://drive.google.com/uc?export=download&id=${f.id}`,
    }));
}

async function fetchFolderFiles(accessToken, folderId, out, parentName = '') {
  let pageToken = '';
  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,webViewLink,modifiedTime)&pageSize=1000${tokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    for (const f of data.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        await fetchFolderFiles(accessToken, f.id, out, f.name);
      } else {
        out.push({ ...f, parent_name: parentName });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
}