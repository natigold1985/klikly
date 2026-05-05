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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { project_id, file_url, file_name, mime_type, target_subfolder, token } = body;

    if (!file_url || !file_name) {
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
      isOwner = project.created_by === me.email || me.role === 'admin';
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

    // Pick subfolder. Photographer => edited (default). Client => client.
    const subKey = target_subfolder || (isProjectClient ? 'client' : 'edited');
    const subfolderId = await findOrCreateSubfolder(accessToken, rootFolderId, subKey);

    // Download the source file from the temp URL and stream to Drive (multipart upload)
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) {
      return Response.json({ error: 'Failed to fetch source file' }, { status: 502 });
    }
    const fileBlob = await fileRes.blob();

    // Multipart upload to Drive
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
    const headerBytes = encoder.encode(metadataPart + filePartHeader);
    const footerBytes = encoder.encode(closeDelim);
    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

    const bodyBytes = new Uint8Array(headerBytes.length + fileBytes.length + footerBytes.length);
    bodyBytes.set(headerBytes, 0);
    bodyBytes.set(fileBytes, headerBytes.length);
    bodyBytes.set(footerBytes, headerBytes.length + fileBytes.length);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink,webViewLink,size,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBytes,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Drive upload failed', uploadRes.status, errText);
      return Response.json({ error: 'Drive upload failed', details: errText }, { status: 502 });
    }

    const driveFile = await uploadRes.json();

    // Notify the OTHER party via push + email (bidirectional)
    notifyUpload(base44, project, isProjectClient).catch((e) => console.error('notify failed', e));

    return Response.json({
      success: true,
      file: {
        id: driveFile.id,
        name: driveFile.name,
        mime_type: driveFile.mimeType,
        size: driveFile.size ? parseInt(driveFile.size) : 0,
        thumbnail_url: driveFile.thumbnailLink ? driveFile.thumbnailLink.replace(/=s\d+/, '=s800') : null,
        view_url: driveFile.webViewLink,
        download_url: `https://drive.google.com/uc?export=download&id=${driveFile.id}`,
        is_image: (driveFile.mimeType || '').startsWith('image/'),
        is_video: (driveFile.mimeType || '').startsWith('video/'),
      },
    });
  } catch (error) {
    console.error('uploadToDrive error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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

async function notifyUpload(base44, project, uploaderIsClient) {
  // Push to the OTHER side
  const targetEmail = uploaderIsClient ? project.created_by : project.client_email;
  if (!targetEmail) return;

  const subs = await base44.asServiceRole.entities.PushSubscription
    .filter({ user_email: targetEmail, is_active: true })
    .catch(() => []);

  for (const sub of subs || []) {
    try {
      await base44.asServiceRole.functions.invoke('sendPushNotification', {
        endpoint: sub.endpoint,
        keys_p256dh: sub.keys_p256dh,
        keys_auth: sub.keys_auth,
        title: uploaderIsClient ? `📷 ${project.client_name} העלה קבצים` : '📁 קבצים חדשים זמינים',
        body: uploaderIsClient
          ? `הלקוח העלה קבצים חדשים לפרויקט ${project.client_name}`
          : `הצלם העלה קבצים חדשים לפרויקט שלך`,
      });
    } catch (e) {
      console.error('push fail', e);
    }
  }

  // Email
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: targetEmail,
      subject: uploaderIsClient
        ? `קבצים חדשים מ-${project.client_name}`
        : `קבצים חדשים זמינים לפרויקט שלך`,
      body: uploaderIsClient
        ? `הלקוח ${project.client_name} העלה קבצים חדשים לפרויקט. היכנס ל-Klikly לצפייה.`
        : `הצלם העלה קבצים חדשים לפרויקט שלך. היכנס ל-Klikly לצפייה והורדה.`,
    });
  } catch (e) {
    console.error('email fail', e);
  }
}