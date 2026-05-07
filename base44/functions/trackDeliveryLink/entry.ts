import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, action = 'view', fileName = '' } = await req.json();

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

    const isDownload = action === 'download';
    const newViewCount = isDownload ? (link.view_count || 0) : (link.view_count || 0) + 1;
    const downloadTimestamp = new Date().toISOString();
    const updateData = isDownload
      ? { is_downloaded: true, downloaded_at: downloadTimestamp }
      : { view_count: newViewCount };

    await base44.asServiceRole.entities.DeliveryLink.update(link.id, updateData);

    if (isDownload) {
      await base44.asServiceRole.entities.Activity.create({
        related_to_type: 'project',
        related_to_id: link.project_id,
        activity_type: 'selection_made',
        title: 'הלקוח לחץ להורדה',
        description: `${link.client_name || 'לקוח'} לחץ על הורדת ${fileName || 'הקבצים'}`,
        metadata: { token, fileName, event: 'download_clicked' }
      });
    }

    // Send email notification to photographer on first download
    if (isDownload && !link.is_downloaded && link.photographer_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: link.photographer_email,
        subject: `הקבצים של משפחת ${link.client_name} הורדו בהצלחה`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #D4AF37;">✅ הורדה בוצעה!</h2>
            <p>הקבצים של משפחת <strong>${link.client_name}</strong> הורדו בהצלחה.</p>
            <p>פרויקט: "<strong>${link.project_title}</strong>"</p>
            <p style="color: #666;">מספר כניסות לקישור: ${newViewCount}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">נשלח מ-Klikly - ניהול לצלמים בקליק</p>
          </div>
        `
      });
    }

    return Response.json({ 
      success: true, 
      file_url: '',
      project_title: link.project_title,
      client_name: link.client_name,
      view_count: newViewCount,
      downloaded_at: isDownload ? updateData.downloaded_at : link.downloaded_at,
      is_downloaded: isDownload ? true : !!link.is_downloaded
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});