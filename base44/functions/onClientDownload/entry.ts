import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, fileName } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    const link = links[0];

    if (!link) {
      return Response.json({ error: '403 Forbidden: Invalid token' }, { status: 403 });
    }

    // 1. Update link tracking status
    if (!link.is_downloaded) {
      await base44.asServiceRole.entities.DeliveryLink.update(link.id, {
        is_downloaded: true,
        downloaded_at: new Date().toISOString(),
      });
    }

    // 2. Log Activity in CRM for the Photographer
    await base44.asServiceRole.entities.Activity.create({
      related_to_type: 'project',
      related_to_id: link.project_id,
      activity_type: 'note_added',
      title: 'Client Downloaded Files',
      description: `Client ${link.client_name} downloaded ${fileName || 'the gallery'} via Magic Link.`,
      metadata: { token, fileName, event: 'download_triggered' }
    });

    // 3. Webhook Skeleton: Send WhatsApp / Push Notification to photographer
    // This can be hooked into Twilio/WhatsApp Business API or Base44 SendEmail
    console.log(`[ALERT] Triggering instant notification to ${link.photographer_email} for download of ${fileName}`);
    
    // Example Email Notification Fallback
    if (link.photographer_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: link.photographer_email,
        subject: `[BASE 44] Gallery Downloaded: ${link.project_title}`,
        body: `Your client ${link.client_name} just started downloading their gallery files (${fileName || 'full-gallery.zip'}).`
      });
    }

    return Response.json({ success: true, message: 'Download tracked securely' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});