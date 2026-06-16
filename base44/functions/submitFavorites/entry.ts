import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId, pin, selectedPhotoIds, selectedPhotoDetails = [], photoComments, notifyPhotographer = true } = await req.json();

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    const currentUser = await getCurrentUser(base44);

    const clientEmails = [
      project?.client_email,
      ...(Array.isArray(project?.client_emails) ? project.client_emails : [])
    ].filter(Boolean).map(e => e.toLowerCase());
    const isProjectClient = !!currentUser?.email && clientEmails.includes(currentUser.email.toLowerCase());

    if (!project || (!isProjectClient && project.gallery_pin !== pin)) {
      return Response.json({ error: 'קוד שגוי' }, { status: 403 });
    }

    // Update all photos for this project
    const photos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId });
    let commentsSummary = [];

    for (const photo of photos) {
       const isSelected = selectedPhotoIds.includes(photo.id);
       const comment = photoComments?.[photo.id] || '';

       let updateData = {};
       if (photo.is_selected !== isSelected) updateData.is_selected = isSelected;
       if (photo.client_comment !== comment) updateData.client_comment = comment;

       if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Photo.update(photo.id, updateData);
       }

       if (comment && isSelected) {
           commentsSummary.push(`${photo.file_name || photo.id}: ${comment}`);
       }
    }

    // Update project stats & status
    await base44.asServiceRole.entities.Project.update(projectId, {
        selected_photos_count: selectedPhotoIds.length,
        status: 'editing'
    });

    // Notify photographer
    const selectedCount = selectedPhotoIds.length;
    const clientName = project.client_name || currentUser?.email || 'הלקוח';
    const projectTitle = project.project_name || project.title || 'הפרויקט';
    const photographerEmail = 'natigold04@gmail.com';
    const selectedLines = selectedPhotoDetails.length > 0
      ? selectedPhotoDetails.map((photo, index) => `${index + 1}. ${photo.name || photo.id}${photo.comment ? ` — הערה: ${photo.comment}` : ''}${photo.url ? `\n   ${photo.url}` : ''}`).join('\n')
      : selectedPhotoIds.map((photoId, index) => `${index + 1}. ${photoId}`).join('\n');

    if (notifyPhotographer && photographerEmail && selectedCount > 0) {
      // Email to photographer
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: photographerEmail,
          from_name: 'KLIKLY',
          subject: `⭐ ${clientName} שמר ${selectedCount} תמונות לבחירה`,
          body: `הלקוח ${clientName} לחץ על שמור בחירות בפרויקט "${projectTitle}".\n\nאלו התמונות שהוא אהב ובחר לעריכה מתוך הקבצים המקוריים:\n${selectedLines}\n\nהשלב הבא: לערוך בדיוק את התמונות האלו ולהעלות את הסופיות לתיקיית הפרויקט.`,
        });
      } catch (e) {
        console.error('Email notification failed:', e);
      }

      // Create Task for photographer
      try {
        await base44.asServiceRole.entities.Task.create({
          title: `עריכת ${selectedCount} תמונות — ${projectTitle}`,
          description: `הלקוח ${clientName} בחר תמונות. יש לערוך ולהעלות חזרה לפרויקט.`,
          related_to_type: 'project',
          related_to_id: projectId,
          status: 'pending',
          priority: 'high',
          stage: 'editing',
        });
      } catch (e) {
        console.error('Task creation failed:', e);
      }
    }

    // Try syncing to Airtable directly
    if (project.airtable_record_id) {
        try {
            const { accessToken } = await base44.asServiceRole.connectors.getConnection("airtable");
            const baseId = "appnKzD3XQO9K";
            const tableId = "tblProjects";

            const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            };

            const fields = {
                "Status": "editing",
                "Selected Photos Count": selectedPhotoIds.length,
                "Package Details": commentsSummary.length > 0 ? "הערות לקוח לעריכה:\n" + commentsSummary.join('\n') : undefined
            };

            await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ records: [{ id: project.airtable_record_id, fields }] })
            });
        } catch (e) {
            console.error('Airtable sync failed:', e);
        }
    }

    return Response.json({ success: true });
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