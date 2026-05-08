import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, wants_reminders = true } = await req.json().catch(() => ({}));

    if (!token) return Response.json({ error: 'token required' }, { status: 400 });

    const projects = await base44.asServiceRole.entities.Project.filter({ client_access_token: token });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Invalid token' }, { status: 404 });

    const now = new Date().toISOString();
    const payload = {
      project_id: project.id,
      token,
      file_url: project.drive_folder_url || '',
      photographer_email: project.created_by,
      client_name: project.client_name,
      client_email: project.client_email,
      client_phone: project.client_phone,
      project_title: project.project_name || project.shooting_type || 'Gallery',
      wants_reminders: !!wants_reminders,
      reminder_consent_at: wants_reminders ? now : null,
      last_notification_sent: null,
    };

    const links = await base44.asServiceRole.entities.DeliveryLink.filter({ token });
    if (links[0]) {
      await base44.asServiceRole.entities.DeliveryLink.update(links[0].id, payload);
    } else {
      await base44.asServiceRole.entities.DeliveryLink.create(payload);
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'gallery_reminder_consent',
      details: `${project.client_name || 'Client'} ${wants_reminders ? 'approved' : 'declined'} gallery save reminders`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project.id,
      owner_id: project.created_by,
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (error) {
    console.error('setGalleryReminderConsent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});