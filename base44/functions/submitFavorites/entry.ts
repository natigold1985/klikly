import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId, pin, selectedPhotoIds = [], selectedPhotoDetails = [], photoComments = {}, notifyPhotographer = true } = await req.json();

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    const currentUser = await getCurrentUser(base44);

    const clientEmails = [
      project?.client_email,
      ...(Array.isArray(project?.client_emails) ? project.client_emails : [])
    ].filter(Boolean).map((email) => String(email).toLowerCase());
    const isProjectClient = !!currentUser?.email && clientEmails.includes(currentUser.email.toLowerCase());

    if (!project || (!isProjectClient && project.gallery_pin !== pin)) {
      return Response.json({ error: 'קוד שגוי' }, { status: 403 });
    }

    const selectedIdSet = new Set(selectedPhotoIds);
    const existingPhotos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId }).catch(() => []);
    const existingByDriveId = new Map(existingPhotos.filter((photo) => photo.drive_file_id).map((photo) => [photo.drive_file_id, photo]));
    const existingById = new Map(existingPhotos.map((photo) => [photo.id, photo]));

    for (const photo of existingPhotos) {
      const selected = selectedIdSet.has(photo.drive_file_id || photo.id);
      const comment = photoComments?.[photo.drive_file_id] || photoComments?.[photo.id] || '';
      const updateData = {};
      if (photo.is_selected !== selected) updateData.is_selected = selected;
      if ((photo.client_comment || '') !== comment) updateData.client_comment = comment;
      if (selected && !photo.selected_at) updateData.selected_at = new Date().toISOString();
      if (Object.keys(updateData).length > 0) await base44.asServiceRole.entities.Photo.update(photo.id, updateData);
    }

    for (const item of selectedPhotoDetails) {
      const driveId = item.drive_file_id || item.id;
      const existing = existingByDriveId.get(driveId) || existingById.get(item.id);
      const payload = {
        project_id: projectId,
        client_email: project.client_email,
        type: 'raw',
        file_url: item.url || item.view_url || item.file_url || '',
        thumbnail_url: item.thumbnail_url || '',
        file_name: item.name || item.file_name || driveId,
        drive_file_id: driveId,
        is_selected: true,
        client_comment: photoComments?.[driveId] || item.comment || '',
        editing_status: 'pending',
        selected_at: new Date().toISOString(),
        order_index: Number(item.order_index || 0)
      };
      if (existing) await base44.asServiceRole.entities.Photo.update(existing.id, payload);
      else if (payload.file_url) await base44.asServiceRole.entities.Photo.create(payload);
    }

    await base44.asServiceRole.entities.Project.update(projectId, {
      selected_photos_count: selectedPhotoIds.length,
      status: 'editing'
    });

    const selectedCount = selectedPhotoIds.length;
    const clientName = project.client_name || currentUser?.email || 'הלקוח';
    const projectTitle = project.project_name || project.shooting_type || 'הפרויקט';
    const photographerEmail = project.created_by || 'natigold04@gmail.com';
    const selectedItems = buildSelectedItems(selectedPhotoIds, selectedPhotoDetails, photoComments, existingPhotos);

    let photographerEmailSent = false;
    if (notifyPhotographer && selectedCount > 0) {
      const emailHtml = buildPhotographerEmail({ clientName, projectTitle, selectedItems, selectedCount });
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: photographerEmail,
        from_name: 'KLIKLY',
        subject: `⭐ ${clientName} שלח ${selectedCount} בחירות לעריכה`,
        body: emailHtml,
      });
      photographerEmailSent = true;

      await base44.asServiceRole.entities.Task.create({
        title: `עריכת ${selectedCount} תמונות — ${projectTitle}`,
        description: `הלקוח ${clientName} בחר ${selectedCount} תמונות לעריכה. פירוט הבחירות וההערות נשלח אליך במייל.`,
        related_to_type: 'project',
        related_to_id: projectId,
        status: 'pending',
        priority: 'high',
        stage: 'editing',
      }).catch(() => {});
    }

    return Response.json({ success: true, photographerEmailSent, selectedCount });
  } catch (error) {
    console.error('submitFavorites error:', error);
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

function buildSelectedItems(selectedPhotoIds, selectedPhotoDetails, photoComments, existingPhotos) {
  const existingById = new Map(existingPhotos.flatMap((photo) => [[photo.id, photo], [photo.drive_file_id, photo]].filter(([key]) => key)));
  return selectedPhotoIds.map((photoId, index) => {
    const detail = selectedPhotoDetails.find((item) => (item.drive_file_id || item.id) === photoId) || {};
    const existing = existingById.get(photoId) || {};
    const name = detail.name || detail.file_name || existing.file_name || photoId;
    const comment = photoComments?.[photoId] || detail.comment || existing.client_comment || '';
    return {
      index: index + 1,
      id: photoId,
      name,
      rawNumber: extractRawNumber(name),
      comment,
      url: detail.url || detail.view_url || detail.file_url || existing.file_url || '',
    };
  });
}

function extractRawNumber(fileName) {
  const clean = String(fileName || '').split('/').pop().replace(/\.[^.]+$/, '');
  const match = clean.match(/(?:IMG|DSC|DSCF|DSC_|_)?0*([0-9]{3,})/i);
  return match ? match[1] : clean;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPhotographerEmail({ clientName, projectTitle, selectedItems, selectedCount }) {
  const rows = selectedItems.map((item) => `
    <tr>
      <td style="padding:14px 12px;border-bottom:1px solid #2a2a2a;color:#FFD700;font-weight:900;text-align:center;">${item.index}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-weight:800;direction:ltr;text-align:left;">${escapeHtml(item.name)}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #2a2a2a;color:#FFD700;font-weight:900;direction:ltr;text-align:left;">${escapeHtml(item.rawNumber)}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #2a2a2a;color:#ccc;line-height:1.6;">${item.comment ? escapeHtml(item.comment) : '—'}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #2a2a2a;text-align:center;">${item.url ? `<a href="${escapeHtml(item.url)}" style="color:#FFD700;text-decoration:underline;">פתיחה</a>` : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 16px;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);padding:30px 34px;text-align:center;border-bottom:2px solid #FFD700;">
          <img src="https://media.base44.com/images/public/699330cced2139a6e7aa06a9/1e11bfcc1_generated_image.png" alt="KLIKLY" style="height:74px;width:auto;object-fit:contain;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;" />
          <div style="color:#FFD700;font-size:26px;font-weight:900;letter-spacing:4px;">KLIKLY</div>
          <div style="color:#888;font-size:12px;letter-spacing:2px;margin-top:4px;">בחירות לקוח לעריכה</div>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#FFD700 0%,#D4AF37 100%);padding:26px 34px;text-align:center;">
          <div style="font-size:34px;margin-bottom:8px;">⭐</div>
          <h1 style="color:#000;font-size:24px;font-weight:900;margin:0;">${escapeHtml(clientName)} שלח בחירות לעריכה</h1>
          <p style="color:#1a1a1a;font-size:14px;margin:8px 0 0;font-weight:700;">${selectedCount} תמונות נבחרו בפרויקט ${escapeHtml(projectTitle)}</p>
        </td></tr>
        <tr><td style="padding:34px 28px 26px;">
          <p style="color:#ccc;font-size:16px;line-height:1.8;margin:0 0 22px;">אלו התמונות שהלקוח בחר לעריכה. עמודת <strong style="color:#FFD700;">מספר RAW</strong> מיועדת לזיהוי מהיר של הקובץ המקורי לעריכה.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
            <thead>
              <tr style="background:#0a0a0a;">
                <th style="padding:12px;color:#FFD700;font-size:12px;text-align:center;">#</th>
                <th style="padding:12px;color:#FFD700;font-size:12px;text-align:left;direction:ltr;">שם קובץ</th>
                <th style="padding:12px;color:#FFD700;font-size:12px;text-align:left;direction:ltr;">מספר RAW</th>
                <th style="padding:12px;color:#FFD700;font-size:12px;text-align:right;">הערות לעריכה</th>
                <th style="padding:12px;color:#FFD700;font-size:12px;text-align:center;">קישור</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="background:#1f1a00;border:1px solid #FFD700;border-right:4px solid #FFD700;border-radius:10px;padding:16px 20px;margin:24px 0 0;">
            <p style="color:#FFD700;font-size:14px;font-weight:900;margin:0 0 4px;">השלב הבא</p>
            <p style="color:#ccc;font-size:13px;line-height:1.7;margin:0;">לערוך בדיוק את הקבצים שמופיעים בטבלה לפי מספר RAW והערות הלקוח.</p>
          </div>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0 18px;">
          <p style="color:#555;font-size:11px;margin:0;text-align:center;line-height:1.8;">הודעה אוטומטית מ-KLIKLY · לא להשיב למייל זה</p>
        </td></tr>
        <tr><td style="background:#0a0a0a;padding:20px 34px;text-align:center;border-top:1px solid #2a2a2a;">
          <div style="color:#FFD700;font-size:16px;font-weight:900;letter-spacing:3px;">KLIKLY</div>
          <div style="color:#444;font-size:11px;margin-top:4px;">© 2026 Klikly. כל הזכויות שמורות.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}