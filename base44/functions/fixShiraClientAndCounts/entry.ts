import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHIRA_EMAILS = ['shira.attal@gmail.com', 'shira@attal-a.co.il'];
const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];
const FIFTEEN_MB = 15 * 1024 * 1024;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const uniqEmails = (emails) => [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];

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

    const allEmails = uniqEmails(SHIRA_EMAILS);
    const members = await base44.asServiceRole.entities.TeamMember.list('-created_date', 500);
    const shiraMembers = members.filter((member) => {
      const emails = uniqEmails([member.email, ...(member.emails || [])]);
      return member.role === 'client' && emails.some((email) => allEmails.includes(email));
    });

    let primary = shiraMembers.find((member) => normalizeEmail(member.email) === allEmails[0]) || shiraMembers[0];
    if (primary) {
      await base44.asServiceRole.entities.TeamMember.update(primary.id, {
        email: allEmails[0],
        emails: allEmails,
        full_name: primary.full_name || 'שירה אטל ארצי',
        phone: primary.phone || '052-5213339',
        role: 'client',
        is_active: true,
      });
      for (const member of shiraMembers) {
        if (member.id !== primary.id) {
          await base44.asServiceRole.entities.TeamMember.update(member.id, {
            is_active: false,
            merged_into_id: primary.id,
            emails: uniqEmails([member.email, ...(member.emails || [])]),
          });
        }
      }
    }

    const projects = await base44.asServiceRole.entities.Project.list('-created_date', 500);
    const shiraProjects = projects.filter((project) => {
      const projectEmails = uniqEmails([project.client_email, ...(project.client_emails || [])]);
      return projectEmails.some((email) => allEmails.includes(email)) || String(project.client_name || '').includes('שירה אטל');
    });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const results = [];
    for (const project of shiraProjects) {
      let rawCount = 0;
      let editedCount = project.final_photos_count || 0;
      const folderId = extractFolderId(project.drive_folder_url);
      if (folderId) {
        const files = [];
        await fetchFolderFiles(accessToken, folderId, files);
        const mediaFiles = files.filter((file) => (file.mimeType || '').startsWith('image/') || (file.mimeType || '').startsWith('video/'));
        rawCount = mediaFiles.filter(isRawFile).length;
        editedCount = mediaFiles.length - rawCount;
      }
      await base44.asServiceRole.entities.Project.update(project.id, {
        client_email: allEmails[0],
        client_emails: allEmails,
        raw_photos_count: rawCount,
        final_photos_count: editedCount,
      });
      results.push({ project_id: project.id, raw: rawCount, edited: editedCount });
    }

    return Response.json({ success: true, primary_client_id: primary?.id || null, merged_count: Math.max(0, shiraMembers.length - 1), projects: results });
  } catch (error) {
    console.error('fixShiraClientAndCounts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});