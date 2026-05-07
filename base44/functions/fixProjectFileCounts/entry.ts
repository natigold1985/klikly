import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];
const FIFTEEN_MB = 15 * 1024 * 1024;

function isRawFile(file) {
  const name = String(file.name || '').toLowerCase();
  return RAW_EXTENSIONS.some((ext) => name.endsWith(ext)) || (file.size || 0) >= FIFTEEN_MB;
}

function extractFolderId(url = '') {
  const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

async function fetchFolderFiles(accessToken, folderId, out) {
  let pageToken = '';
  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000${tokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await fetchFolderFiles(accessToken, file.id, out);
      } else {
        out.push({ ...file, size: file.size ? parseInt(file.size) : 0 });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const projects = body.project_id
      ? await base44.asServiceRole.entities.Project.filter({ id: body.project_id })
      : await base44.asServiceRole.entities.Project.list('-created_date', 500);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const results = [];

    for (const project of projects) {
      const folderId = extractFolderId(project.drive_folder_url);
      if (!folderId) continue;
      const files = [];
      await fetchFolderFiles(accessToken, folderId, files);
      const mediaFiles = files.filter((file) => (file.mimeType || '').startsWith('image/') || (file.mimeType || '').startsWith('video/'));
      const rawCount = mediaFiles.filter(isRawFile).length;
      const editedCount = mediaFiles.length - rawCount;
      await base44.asServiceRole.entities.Project.update(project.id, {
        raw_photos_count: rawCount,
        final_photos_count: editedCount,
      });
      results.push({ project_id: project.id, client_name: project.client_name, raw: rawCount, edited: editedCount, total: mediaFiles.length });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('fixProjectFileCounts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});