import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, file_url, file_name, file_size } = await req.json();

    if (!token || !file_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate token
    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    const link = links[0];

    if (!link) {
      return Response.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Create Photo record for the uploaded file
    const photo = await base44.asServiceRole.entities.Photo.create({
      project_id: link.project_id,
      type: 'client_upload',
      file_url: file_url,
      file_name: file_name || 'Client Upload',
      file_size: file_size || 0,
      is_selected: false
    });

    // Notify photographer (optional, but good for UX)
    if (link.photographer_email) {
       await base44.asServiceRole.integrations.Core.SendEmail({
        to: link.photographer_email,
        subject: `📂 הלקוח ${link.client_name} העלה קובץ חדש`,
        body: `
          <div dir="rtl" style="font-family: Arial, sans-serif;">
            <h3>קובץ חדש הועלה לפרויקט "${link.project_title}"</h3>
            <p>הלקוח העלה קובץ בשם: ${file_name || 'ללא שם'}</p>
            <a href="${file_url}">צפה בקובץ</a>
          </div>
        `
      });
    }

    return Response.json({ success: true, photo });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});