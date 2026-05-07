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
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return Response.json({ error: 'Link expired', expired: true }, { status: 410 });
    }

    // Delivery Tracking: Register view in the CRM silently
    await base44.asServiceRole.entities.DeliveryLink.update(link.id, {
      view_count: (link.view_count || 0) + 1,
    });

    // ABSOLUTE ISOLATION: The Client Portal receives strictly what it needs to render the gallery.
    // Zero CRM entity data, zero IDs, zero financial/status info.
    return Response.json({
      success: true,
      project_title: link.project_title,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});