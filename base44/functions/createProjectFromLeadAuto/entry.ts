import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leadId, leadName, leadEmail, leadPhone, serviceType, shootingDate } = await req.json();

    if (!leadId || !leadName || !leadEmail) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create project from lead details
    const project = await base44.asServiceRole.entities.Project.create({
      client_name: leadName,
      client_email: leadEmail,
      client_phone: leadPhone,
      lead_id: leadId,
      project_name: `${leadName} - ${serviceType || 'עיבוד צילום'}`,
      shooting_type: serviceType || 'ישיבה אישית',
      shooting_date: shootingDate || new Date().toISOString().split('T')[0],
      status: 'pending_payment',
      payment_status: 'pending',
    });

    // Mark lead as converted
    await base44.asServiceRole.entities.Lead.update(leadId, {
      status: 'נוצר קשר',
      pipeline_stage: 'contract_closed',
    });

    // Log the conversion
    await base44.asServiceRole.entities.Activity.create({
      related_to_type: 'lead',
      related_to_id: leadId,
      activity_type: 'status_change',
      title: 'המרה לפרויקט',
      description: `הליד הומר לפרויקט #${project.id}`,
    });

    return Response.json({ success: true, projectId: project.id, leadId });
  } catch (error) {
    console.error('createProjectFromLeadAuto error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});