import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

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

    // THE DELIVERY GATEWAY: Return ONLY strictly necessary frontend presentation data.
    // Zero CRM entity data, zero IDs, zero financial/status info.
    return Response.json({
      success: true,
      project_title: link.project_title,
      client_name: link.client_name,
      file_size_label: link.file_size_label,
      cover_image_url: link.cover_image_url,
      // File list (In production, this would map directly to DB records linked to the project)
      files: [
        { name: 'full-gallery.zip', type: 'archive', size: link.file_size_label || 'Unknown' }
      ]
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});