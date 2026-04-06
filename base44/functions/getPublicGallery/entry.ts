import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId, pin } = await req.json();

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    
    if (!project || project.gallery_pin !== pin) {
      return Response.json({ error: 'קוד אישי שגוי או פרויקט לא נמצא' }, { status: 403 });
    }

    // Only fetch raw/edited photos for selection
    const allPhotos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId });
    
    // Sort and structure photos
    const photos = allPhotos.map(p => ({
        id: p.id,
        url: p.file_url,
        thumbnail: p.thumbnail_url || p.file_url,
        is_selected: p.is_selected
    }));

    return Response.json({
        project: {
            id: project.id,
            client_name: project.client_name,
            shooting_type: project.shooting_type,
            shooting_date: project.shooting_date
        },
        photos 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});