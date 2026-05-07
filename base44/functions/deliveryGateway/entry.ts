import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, pin } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    const link = links[0];

    if (!link) {
      return Response.json({ error: '403 Forbidden: Link not found or invalid' }, { status: 403 });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return Response.json({ error: '410 Gone: Link expired', expired: true }, { status: 410 });
    }

    const projects = await base44.asServiceRole.entities.Project.filter({ id: link.project_id });
    const project = projects[0];
    const currentUser = await getCurrentUser(base44);
    const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'natigold04@gmail.com';
    if (project?.gallery_pin && !isAdmin && String(pin || '').trim() !== String(project.gallery_pin).trim()) {
      return Response.json({ error: 'pin_required', pin_required: true }, { status: 403 });
    }

    // THE DELIVERY GATEWAY: Return ONLY strictly necessary frontend presentation data.
    // Zero CRM entity data, zero IDs, zero financial/status info.
    return Response.json({
      success: true,
      project_title: link.project_title,
      client_name: link.client_name,
      file_size_label: link.file_size_label,
      cover_image_url: link.cover_image_url,
      drive_folder_url: project?.drive_folder_url || '',
      files: [
        { name: 'Google Drive', type: 'folder', size: link.file_size_label || 'Drive', view_url: project?.drive_folder_url || '' }
      ]
    });

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