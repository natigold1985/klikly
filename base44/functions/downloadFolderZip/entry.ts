import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

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

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const allFiles = [];
    await fetchFolderFiles(accessToken, folder_id, allFiles);

    const seen = new Set();
    const files = allFiles.filter(isDeliverable).filter((file) => {
      const key = `${String(file.name || '').trim().toLowerCase()}-${file.size || 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const zip = new JSZip();
    for (const file of files) {
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (fileRes.ok) zip.file(safeFileName(file.name), await fileRes.arrayBuffer());
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    let binary = '';
    for (let i = 0; i < zipBytes.length; i += 1) binary += String.fromCharCode(zipBytes[i]);

    return Response.json({ name: `${safeFileName(project.project_name || project.client_name || 'studio-gold-gallery')}.zip`, base64: btoa(binary), file_count: files.length });
  } catch (error) {
    console.error('downloadFolderZip error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function isDeliverable(file) {
  const name = String(file.name || '').toLowerCase();
  const size = Number(file.size || 0);
  if (!size || size > MAX_SIZE) return false;
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