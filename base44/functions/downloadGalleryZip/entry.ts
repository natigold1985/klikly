import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

function extractFolderId(url = '') {
  const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json().catch(() => ({}));
    if (!token) return Response.json({ error: 'token required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Invalid token' }, { status: 404 });

    const folderId = extractFolderId(project.drive_folder_url);
    if (!folderId) return Response.json({ error: 'Project has no valid Drive folder' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const files = [];
    await fetchFolderFiles(accessToken, folderId, files);

    const visibleFiles = files.filter((file) => {
      const size = file.size ? parseInt(file.size) : 0;
      return /ערוכות|edited/i.test(file.parent_name || '') && size > 0 && size < 15 * 1024 * 1024;
    });

    const zip = new JSZip();
    for (const file of visibleFiles) {
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (fileRes.ok) {
        zip.file(safeFileName(file.name), await fileRes.arrayBuffer());
      }
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    let binary = '';
    for (let i = 0; i < zipBytes.length; i += 1) binary += String.fromCharCode(zipBytes[i]);

    return Response.json({
      name: `${safeFileName(project.project_name || project.client_name || 'studio-gold-gallery')}.zip`,
      base64: btoa(binary),
      file_count: visibleFiles.length,
    });
  } catch (error) {
    console.error('downloadGalleryZip error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function fetchFolderFiles(accessToken, folderId, out, parentName = '') {
  let pageToken = '';
  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000${tokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await fetchFolderFiles(accessToken, file.id, out, file.name);
      } else {
        out.push({ ...file, parent_name: parentName });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
}

function safeFileName(name = 'gallery') {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'gallery';
}