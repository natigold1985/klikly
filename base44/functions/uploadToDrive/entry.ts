// Uploads a file to a specific Google Drive subfolder of a project.
// Expected payload: { project_id, file_url, file_name, mime_type, target_subfolder?, uploaded_by_role? }
// - file_url: the temp URL returned by base44.integrations.Core.UploadFile (large files supported, up to platform limit)
// - target_subfolder: 'edited' | 'raw' | 'client' | 'docs' (default: 'edited' for photographer, 'client' for client)
//
// Security: enforces strict isolation — the file is placed ONLY inside the project's drive_folder_url.
// Caller can be either the project owner (photographer) or the project's client (uploader_by_role='client').
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUBFOLDER_NAMES = {
  edited: ['ערוכות (Edited)', 'ערוכות', 'Edited'],
  raw: ['גלמים (RAW)', 'גלמים', 'RAW'],
  client: ['בחירת לקוח', 'Client Selection', 'Client'],
  docs: ['חוזים ומסמכים', 'Documents'],
};

const RAW_EXTENSIONS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];
const FIFTEEN_MB = 15 * 1024 * 1024;

function isRawFile(fileName = '', fileSize = 0) {
  const name = String(fileName).toLowerCase();
  return RAW_EXTENSIONS.some((ext) => name.endsWith(ext)) || Number(fileSize || 0) >= FIFTEEN_MB;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { project_id, file_url, file_name, mime_type, target_subfolder, token, check_only, direct_upload_init, direct_upload_complete, drive_file_id, drive_file, file_size } = body;

    if (!file_name || (!file_url && !check_only && !direct_upload_init && !direct_upload_complete)) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Two access modes:
    //  A) Authenticated photographer/admin/client → project_id
    //  B) PUBLIC anonymous client via Magic Link → token (no auth needed)
    let project = null;
    let isProjectClient = false;
    let isOwner = false;

    if (token) {
      const list = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
      project = list[0];
      if (!project) return Response.json({ error: 'Invalid token' }, { status: 404 });
      isProjectClient = true; // token-based uploads always go to client subfolder
    } else {
      const me = await base44.auth.me();
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
      const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
      project = projects[0];
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      isOwner = project.created_by === me.email || project.created_by_id === me.id || project.user_id === me.id || me.role === 'admin';
      isProjectClient = me.role === 'client' && project.client_email === me.email;
      if (!isOwner && !isProjectClient) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!project.drive_folder_url) {
      return Response.json({ error: 'Project has no Drive folder yet' }, { status: 400 });
    }

    // === STRICT ISOLATION GUARD ===
    // Only allow uploads into a specific /folders/<id> — never the Drive root.
    const folderMatch = project.drive_folder_url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    const rootFolderId = folderMatch?.[1];
    if (!rootFolderId || rootFolderId.length < 10 || rootFolderId.toLowerCase() === 'my-drive' || rootFolderId.toLowerCase() === 'root') {
      console.error('SECURITY: upload rejected — invalid/root folder URL', project.drive_folder_url);
      return Response.json({ error: 'Invalid drive_folder_url — must be a specific folder, not Drive root' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    if (direct_upload_complete) {
      let completedFile = drive_file || null;
      if (!completedFile && drive_file_id) {
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${drive_file_id}?fields=id,name,thumbnailLink,webViewLink,size,mimeType`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (metaRes.ok) completedFile = await metaRes.json();
      }
      if (!completedFile) return Response.json({ error: 'Missing uploaded file metadata' }, { status: 400 });

      const countPatch = {};
      if ((completedFile.mimeType || '').startsWith('image/') || (completedFile.mimeType || '').startsWith('video/')) {
        if (isRawFile(completedFile.name, completedFile.size)) {
          countPatch.raw_photos_count = (project.raw_photos_count || 0) + 1;
        } else {
          countPatch.final_photos_count = (project.final_photos_count || 0) + 1;
        }
      }
      if (Object.keys(countPatch).length > 0) {
        await base44.asServiceRole.entities.Project.update(project.id, countPatch).catch(() => {});
      }

      notifyUpload(base44, project, isProjectClient, {
        name: completedFile.name,
        size: completedFile.size ? parseInt(completedFile.size) : 0,
      }).catch((e) => console.error('notify failed', e));

      return Response.json({ success: true, file: mapDriveFile(completedFile) });
    }

    // Pick subfolder. Photographer => edited (default). Client => client.
    const subKey = target_subfolder || (isProjectClient ? 'client' : 'edited');
    const subfolderId = await findOrCreateSubfolder(accessToken, rootFolderId, subKey);

    const existingFile = await findExistingFileByName(accessToken, subfolderId, file_name);
    if (existingFile || check_only) {
      return Response.json({
        success: true,
        exists: !!existingFile,
        skipped: !!existingFile,
        reason: existingFile ? 'duplicate_file_name' : null,
        message: existingFile ? 'הקובץ כבר קיים במערכת' : 'הקובץ לא קיים בתיקייה',
        file: existingFile ? mapDriveFile(existingFile) : null,
      });
    }

    if (direct_upload_init) {
      const metadata = {
        name: file_name,
        parents: [subfolderId],
        mimeType: mime_type || 'application/octet-stream',
      };
      const sessionRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,thumbnailLink,webViewLink,size,mimeType',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': metadata.mimeType,
            ...(file_size ? { 'X-Upload-Content-Length': String(file_size) } : {}),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!sessionRes.ok) {
        return Response.json({ error: 'Failed to create Drive upload session', details: await sessionRes.text() }, { status: 502 });
      }

      return Response.json({ success: true, upload_url: sessionRes.headers.get('Location') });
    }

    // Download the source file and stream it to Drive without loading the whole file into RAM
    const fileRes = await fetch(file_url);
    if (!fileRes.ok || !fileRes.body) {
      return Response.json({ error: 'Failed to fetch source file' }, { status: 502 });
    }

    // Multipart upload to Drive using a streaming body
    const metadata = {
      name: file_name,
      parents: [subfolderId],
      mimeType: mime_type || 'application/octet-stream',
    };

    const boundary = '-------klikly-' + Math.random().toString(36).slice(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);
    const filePartHeader = delimiter +
      `Content-Type: ${metadata.mimeType}\r\n\r\n`;

    const encoder = new TextEncoder();
    const uploadBody = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(metadataPart + filePartHeader));
        const reader = fileRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(encoder.encode(closeDelim));
        controller.close();
      }
    });

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink,webViewLink,size,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: uploadBody,
        duplex: 'half',
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Drive upload failed', uploadRes.status, errText);
      return Response.json({ error: 'Drive upload failed', details: errText }, { status: 502 });
    }

    const driveFile = await uploadRes.json();

    const countPatch = {};
    if (driveFile.mimeType?.startsWith('image/') || driveFile.mimeType?.startsWith('video/')) {
      if (isRawFile(driveFile.name, driveFile.size)) {
        countPatch.raw_photos_count = (project.raw_photos_count || 0) + 1;
      } else {
        countPatch.final_photos_count = (project.final_photos_count || 0) + 1;
      }
    }
    if (Object.keys(countPatch).length > 0) {
      await base44.asServiceRole.entities.Project.update(project.id, countPatch).catch(() => {});
    }

    // Notify the OTHER party via push + email + DB log (bidirectional, fire-and-forget)
    notifyUpload(base44, project, isProjectClient, {
      name: driveFile.name,
      size: driveFile.size ? parseInt(driveFile.size) : 0,
    }).catch((e) => console.error('notify failed', e));

    return Response.json({
      success: true,
      file: mapDriveFile(driveFile),
    });
  } catch (error) {
    console.error('uploadToDrive error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function escapeDriveQueryValue(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapDriveFile(file) {
  return {
    id: file.id,
    name: file.name,
    mime_type: file.mimeType,
    size: file.size ? parseInt(file.size) : 0,
    thumbnail_url: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s800') : null,
    view_url: file.webViewLink,
    download_url: `https://drive.google.com/uc?export=download&id=${file.id}`,
    is_image: (file.mimeType || '').startsWith('image/'),
    is_video: (file.mimeType || '').startsWith('video/'),
    is_audio: (file.mimeType || '').startsWith('audio/'),
    is_document: isDocumentFile(file.name, file.mimeType),
  };
}

function isDocumentFile(name = '', mimeType = '') {
  const lower = String(name).toLowerCase();
  return String(mimeType).includes('pdf') || ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].some((ext) => lower.endsWith(ext));
}

async function findExistingFileByName(accessToken, folderId, fileName) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${escapeDriveQueryValue(fileName)}' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,thumbnailLink,webViewLink,size,mimeType)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0] || null;
}

async function findOrCreateSubfolder(accessToken, rootFolderId, key) {
  const candidateNames = SUBFOLDER_NAMES[key] || [key];
  // Search children of root for any matching subfolder
  const q = encodeURIComponent(
    `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const existing = (listData.files || []).find((f) =>
    candidateNames.some((n) => n.toLowerCase() === f.name.toLowerCase())
  );
  if (existing) return existing.id;

  // Create new subfolder with the first candidate name
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: candidateNames[0],
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    }),
  });
  const created = await createRes.json();
  return created.id;
}

async function notifyUpload(base44, project, uploaderIsClient, fileMeta = {}) {
  const targetEmail = uploaderIsClient ? project.created_by : project.client_email;

  // === DB LOG (always, even if notify targets are missing) ===
  try {
    await base44.asServiceRole.entities.SystemLog.create({
      action: uploaderIsClient ? 'client_uploaded_files' : 'photographer_uploaded_files',
      details: `${uploaderIsClient ? 'Client' : 'Photographer'} uploaded "${fileMeta.name || 'file'}" to project ${project.client_name}`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project.id,
      owner_id: project.created_by,
    });
  } catch (e) {
    console.error('SystemLog create failed', e);
  }

  try {
    await base44.asServiceRole.entities.Activity.create({
      related_to_type: 'project',
      related_to_id: project.id,
      activity_type: 'photos_uploaded',
      title: uploaderIsClient
        ? `הלקוח ${project.client_name} העלה קובץ`
        : `קובץ חדש הועלה לפרויקט`,
      description: fileMeta.name ? `קובץ: ${fileMeta.name}` : '',
      metadata: { uploaded_by: uploaderIsClient ? 'client' : 'photographer', file_name: fileMeta.name, file_size: fileMeta.size },
    });
  } catch (e) {
    console.error('Activity create failed', e);
  }

  if (!targetEmail) return;

  // Build deep-link to the project page (Drive folder for photographer)
  const projectUrl = uploaderIsClient
    ? (project.drive_folder_url || '')
    : '';

  // === PUSH (delegated to sendPushNotification, which handles VAPID + auto-cleanup) ===
  try {
    await base44.asServiceRole.functions.invoke('sendPushNotification', {
      target_email: targetEmail,
      title: uploaderIsClient ? `📷 ${project.client_name} העלה קובץ` : '📁 קבצים חדשים זמינים',
      body: uploaderIsClient
        ? `${fileMeta.name || 'קובץ חדש'} נוסף לפרויקט`
        : `הצלם העלה קבצים חדשים לפרויקט שלך`,
      url: projectUrl || '/',
    });
  } catch (e) {
    console.error('push fail', e);
  }

  // === EMAIL ===
  try {
    const subject = uploaderIsClient
      ? `📷 ${project.client_name} העלה קבצים חדשים`
      : `קבצים חדשים זמינים לפרויקט שלך`;

    const driveLink = projectUrl
      ? `<p style="margin:24px 0;text-align:center;"><a href="${projectUrl}" style="background:#FFD700;color:#000;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:bold;display:inline-block;">פתח את התיקייה ב-Google Drive</a></p>`
      : '';

    const body = uploaderIsClient
      ? `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#111;">📷 ${project.client_name} העלה קבצים</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;">
            הלקוח <strong>${project.client_name}</strong> זה עתה העלה קובץ חדש לפרויקט.<br/>
            ${fileMeta.name ? `<span style="color:#666;font-size:13px;">קובץ: ${fileMeta.name}</span>` : ''}
          </p>
          ${driveLink}
          <p style="color:#999;font-size:12px;margin-top:32px;">KLIKLY · התראה אוטומטית</p>
        </div>`
      : `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;padding:24px;">
          <h2>קבצים חדשים זמינים</h2>
          <p>הצלם העלה קבצים חדשים לפרויקט שלך. היכנס ל-Klikly לצפייה והורדה.</p>
        </div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: targetEmail,
      subject,
      body,
    });
  } catch (e) {
    console.error('email fail', e);
  }
}