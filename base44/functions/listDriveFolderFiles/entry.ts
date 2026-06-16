import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];
const MAX_SIZE = 15 * 1024 * 1024;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { folder_id } = await req.json().catch(() => ({}));
    if (!folder_id) return Response.json({ error: 'folder_id required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);
    const project = projects.find((p) => String(p.drive_folder_url || '').includes(folder_id));
    if (!project) return Response.json({ error: 'Gallery not found' }, { status: 404 });

    if (project.gallery_requires_payment && project.payment_status !== 'paid') {
      await createAudit(base44, req, project, folder_id, 'payment_required_blocked', 0, null);
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'gallery_payment_blocked',
        details: `Gallery access blocked until payment for ${project.client_name || project.id}`,
        status: 'pending',
        related_entity_type: 'Project',
        related_entity_id: project.id,
        owner_id: project.created_by_id || project.created_by || '',
      }).catch(() => {});
      return Response.json({ error: 'payment_required', message: 'הגלריה זמינה רק לאחר תשלום' }, { status: 402 });
    }

    const firstDownloadAt = project.first_download_at ? new Date(project.first_download_at) : null;
    if (firstDownloadAt && Date.now() - firstDownloadAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
      await createAudit(base44, req, project, folder_id, 'expired_access_blocked', 0, null);
      return Response.json({ error: 'Gallery expired' }, { status: 410 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    await ensurePublicReader(accessToken, folder_id);
    const allFiles = [];
    await fetchFolderFiles(accessToken, folder_id, allFiles);

    const seen = new Set();
    const files = allFiles
      .filter((file) => isDeliverable(file))
      .filter((file) => {
        const key = `${String(file.name || '').trim().toLowerCase()}-${file.size || 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((file) => ({
        id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        size: Number(file.size || 0),
        thumbnail_url: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s1600') : '',
        view_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        download_url: file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`,
        is_video: String(file.mimeType || '').startsWith('video/'),
        is_image: String(file.mimeType || '').startsWith('image/'),
        is_audio: String(file.mimeType || '').startsWith('audio/'),
        is_document: false,
        parent_name: file.parent_name || '',
      }));

    await createAudit(base44, req, project, folder_id, 'gallery_open', files.length, null);
    await upsertDeliveryLink(base44, project, folder_id, files.length);

    return Response.json({ project: serializeProject(project, folder_id), files });
  } catch (error) {
    console.error('listDriveFolderFiles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function isDeliverable(file) {
  const name = String(file.name || '').toLowerCase();
  const size = Number(file.size || 0);
  if (!size) return false;
  if (RAW_EXTENSIONS.some((ext) => name.endsWith(ext))) return false;
  return String(file.mimeType || '').startsWith('image/') || String(file.mimeType || '').startsWith('video/');
}

async function fetchFolderFiles(accessToken, folderId, out, parentName = '') {
  let pageToken = '';
  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,modifiedTime,webContentLink,webViewLink)&pageSize=1000${tokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await ensurePublicReader(accessToken, file.id);
        await fetchFolderFiles(accessToken, file.id, out, file.name);
      } else {
        await ensurePublicReader(accessToken, file.id);
        out.push({ ...file, parent_name: parentName });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
}

async function ensurePublicReader(accessToken, fileId) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }),
  }).catch(() => {});
}

function serializeProject(project, folderId) {
  const firstDownloadAt = project.first_download_at ? new Date(project.first_download_at) : null;
  const expiresAt = firstDownloadAt ? new Date(firstDownloadAt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : null;
  return {
    id: project.id,
    folder_id: folderId,
    client_name: project.client_name,
    shooting_type: project.shooting_type,
    shooting_date: project.shooting_date,
    project_name: project.project_name || project.shooting_type || 'Studio Gold Gallery',
    expires_at: expiresAt,
  };
}

async function upsertDeliveryLink(base44, project, folderId, fileCount) {
  const now = new Date().toISOString();
  const token = `folder:${folderId}`;
  const existing = await base44.asServiceRole.entities.DeliveryLink.filter({ token }).catch(() => []);
  const payload = {
    project_id: project.id,
    token,
    file_url: project.drive_folder_url || '',
    photographer_email: project.created_by,
    client_name: project.client_name,
    client_email: project.client_email,
    client_phone: project.client_phone,
    project_title: project.project_name || project.shooting_type || 'Gallery',
    wants_reminders: true,
    reminder_consent_at: existing[0]?.reminder_consent_at || now,
    view_count: (existing[0]?.view_count || 0) + 1,
    last_bulk_download_count: fileCount,
  };
  if (existing[0]) await base44.asServiceRole.entities.DeliveryLink.update(existing[0].id, payload).catch(() => {});
  else await base44.asServiceRole.entities.DeliveryLink.create(payload).catch(() => {});
}

async function createAudit(base44, req, project, folderId, actionType, fileCount, consentText) {
  await base44.asServiceRole.entities.DeliveryAudit.create({
    project_id: project.id,
    folder_id: folderId,
    client_name: project.client_name,
    client_email: project.client_email,
    project_title: project.project_name || project.shooting_type || 'Gallery',
    action_type: actionType,
    ip_address: getIp(req),
    user_agent: req.headers.get('user-agent') || '',
    file_count: fileCount || 0,
    consent_text: consentText || '',
  }).catch(() => {});
}

function getIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}