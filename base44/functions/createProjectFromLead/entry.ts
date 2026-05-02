import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered when a Lead's status changes to 'closed_won'.
// Creates a Project, an auto Contact, and logs activity history.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const lead = payload.data;
    const oldLead = payload.old_data;

    if (!lead) return Response.json({ success: true });

    // Trigger only if status changed to closed_won
    if (lead.status !== 'closed_won' || oldLead?.status === 'closed_won') {
      return Response.json({ success: true, skipped: 'no_status_change' });
    }

    // 1. Create Project (if not already exists)
    const existingProjects = await base44.asServiceRole.entities.Project.filter({ lead_id: lead.id });
    let project;
    if (existingProjects.length === 0) {
      project = await base44.asServiceRole.entities.Project.create({
        lead_id: lead.id,
        client_name: lead.name,
        client_phone: lead.phone,
        client_email: lead.email,
        shooting_type: lead.shooting_type,
        status: 'pending_payment',
        total_price: lead.budget || 0,
        created_by: lead.created_by,
      });
    } else {
      project = existingProjects[0];
    }

    // 2. Create or update Contact (if not already exists for this photographer)
    let contact = null;
    if (lead.phone) {
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({
        created_by: lead.created_by,
        phone: lead.phone,
      });

      if (existingContacts.length === 0) {
        contact = await base44.asServiceRole.entities.Contact.create({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          type: 'client',
          address: lead.address,
          source: lead.source,
          notes: `נוצר אוטומטית מליד שנסגר${lead.shooting_type ? ' (' + lead.shooting_type + ')' : ''}`,
          total_projects: 1,
          total_revenue: lead.budget || 0,
          last_project_date: new Date().toISOString().split('T')[0],
          created_by: lead.created_by,
        });
      } else {
        // Existing contact — update stats
        contact = existingContacts[0];
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          total_projects: (contact.total_projects || 0) + 1,
          total_revenue: (contact.total_revenue || 0) + (lead.budget || 0),
          last_project_date: new Date().toISOString().split('T')[0],
          email: contact.email || lead.email,
          address: contact.address || lead.address,
        });
      }
    }

    // 3. Log activity history (on the project)
    if (project) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          related_to_type: 'project',
          related_to_id: project.id,
          activity_type: 'status_change',
          title: 'הפרויקט נוצר אוטומטית מליד שנסגר',
          description: `ליד "${lead.name}" הפך לפרויקט.${contact ? ' איש קשר ' + (contact.created_date ? 'נוצר' : 'עודכן') + ' אוטומטית.' : ''}`,
          metadata: {
            lead_id: lead.id,
            contact_id: contact?.id,
            auto: true,
          },
        });
      } catch (e) {
        console.error('activity log failed', e);
      }
    }

    return Response.json({
      success: true,
      project_id: project?.id,
      contact_id: contact?.id,
    });
  } catch (error) {
    console.error('createProjectFromLead error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});