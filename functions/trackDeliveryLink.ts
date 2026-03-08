import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find the delivery link by token
    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    const link = links[0];

    if (!link) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return Response.json({ error: 'Link expired' }, { status: 410 });
    }

    // Update tracking data
    const newViewCount = (link.view_count || 0) + 1;
    const updateData = {
      view_count: newViewCount,
      is_downloaded: true,
      downloaded_at: link.downloaded_at || new Date().toISOString(),
    };

    await base44.asServiceRole.entities.DeliveryLink.update(link.id, updateData);

    // Send email notification to photographer on first download
    if (!link.is_downloaded && link.photographer_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: link.photographer_email,
        subject: `✅ הלקוח ${link.client_name} הוריד את הקבצים!`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #D4AF37;">✅ הורדה בוצעה!</h2>
            <p>הלקוח <strong>${link.client_name}</strong> מהפרויקט "<strong>${link.project_title}</strong>" הוריד את הקבצים עכשיו.</p>
            <p style="color: #666;">מספר כניסות לקישור: ${newViewCount}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">נשלח מ-Klikly - ניהול לצלמים בקליק</p>
          </div>
        `
      });
    }

    return Response.json({ 
      success: true, 
      file_url: link.file_url,
      project_title: link.project_title,
      client_name: link.client_name,
      view_count: newViewCount
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});