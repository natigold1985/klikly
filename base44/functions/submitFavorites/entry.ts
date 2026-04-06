import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId, pin, selectedPhotoIds } = await req.json();

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    
    if (!project || project.gallery_pin !== pin) {
      return Response.json({ error: 'קוד שגוי' }, { status: 403 });
    }

    // Update all photos for this project
    const photos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId });
    for (const photo of photos) {
       const isSelected = selectedPhotoIds.includes(photo.id);
       if (photo.is_selected !== isSelected) {
          await base44.asServiceRole.entities.Photo.update(photo.id, { is_selected: isSelected });
       }
    }

    // Update project stats & status
    await base44.asServiceRole.entities.Project.update(projectId, {
        selected_photos_count: selectedPhotoIds.length,
        status: 'editing'
    });

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
                "Selected Photos Count": selectedPhotoIds.length
            };

            await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ records: [{ id: project.airtable_record_id, fields }] })
            });
        } catch (e) {
            console.error('Airtable sync failed:', e);
            // Non-blocking error
        }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});