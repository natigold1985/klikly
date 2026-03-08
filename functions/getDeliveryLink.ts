import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return Response.json({ error: 'Link expired', expired: true }, { status: 410 });
    }

    // Track view (without marking as downloaded)
    await base44.asServiceRole.entities.DeliveryLink.update(link.id, {
      view_count: (link.view_count || 0) + 1,
    });

    return Response.json({
      success: true,
      project_title: link.project_title,
      client_name: link.client_name,
      cover_image_url: link.cover_image_url,
      file_size_label: link.file_size_label,
      is_downloaded: link.is_downloaded,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});