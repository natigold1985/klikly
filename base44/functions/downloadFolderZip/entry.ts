import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import JSZip from 'npm:jszip@3.10.1';

const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];

Deno.serve(async (req) => {
  let base44 = null;
  let project = null;
  let folderId = '';
  try {
    base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    folderId = body.folder_id || '';
    if (!folderId) return Response.json({ error: 'folder_id required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);
    project = projects.find((p) => String(p.drive_folder_url || '').includes(folderId));
    if (!project) return Response.json({ error: 'Gallery not found' }, { status: 404 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const allFiles = [];
    await fetchFolderFiles(accessToken, folderId, allFiles);

    const seen = new Set();
    const files = allFiles.filter(isDeliverable).filter((file) => {
      const key = `${String(file.name || '').trim().toLowerCase()}-${file.size || 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!files.length) {
      await logZip(base44, project, 'zip_download_empty', 'No deliverable files found for ZIP download', 'error', 0);
      return Response.json({ error: 'לא נמצאו קבצים זמינים להורדה' }, { status: 404 });
    }

    const zip = new JSZip();
    let addedCount = 0;
    for (const file of files) {
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (fileRes.ok) {
        const folderName = safeFileName(file.parent_name || '');
        const fileName = safeFileName(file.name);
        const zipPath = folderName ? `${folderName}/${fileName}` : fileName;
        zip.file(zipPath, await fileRes.arrayBuffer());
        addedCount += 1;
      }
    }

    if (!addedCount) {
      await logZip(base44, project, 'zip_download_failed', 'Drive files were found but none could be fetched into ZIP', 'error', files.length);
      return Response.json({ error: 'לא ניתן היה להכין את קובץ ה-ZIP' }, { status: 502 });
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const zipName = `${safeFileName(project.project_name || project.client_name || 'studio-gold-gallery')}.zip`;
    await logZip(base44, project, 'zip_download_ready', `ZIP generated successfully. Files in ZIP: ${addedCount}`, 'success', addedCount);

    return new Response(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        'X-File-Count': String(addedCount),
        'X-File-Name': encodeURIComponent(zipName),
      },
    });
  } catch (error) {
    console.error('downloadFolderZip error:', error);
    if (base44 && project) {
      await logZip(base44, project, 'zip_download_failed', error.message || 'ZIP download failed', 'error', 0).catch(() => {});
    }
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
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000${tokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') await fetchFolderFiles(accessToken, file.id, out, file.name);
      else out.push({ ...file, parent_name: parentName });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
}

function safeFileName(name = 'gallery') {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'gallery';
}

async function logZip(base44, project, action, details, status, fileCount) {
  await base44.asServiceRole.entities.SystemLog.create({
    action,
    details: `${details}. Project: ${project.id}. Client: ${project.client_name || project.client_email || ''}`,
    status,
    related_entity_type: 'Project',
    related_entity_id: project.id,
    owner_id: project.created_by_id || project.created_by || '',
  }).catch(() => {});

  await base44.asServiceRole.entities.Activity.create({
    related_to_type: 'project',
    related_to_id: project.id,
    activity_type: 'photos_uploaded',
    title: status === 'success' ? 'קובץ ZIP הוכן להורדה' : 'הכנת ZIP נכשלה',
    description: details,
    metadata: { file_count: fileCount || 0, action },
  }).catch(() => {});
}