import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const uniqEmails = (emails) => [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { primary_user_id, secondary_user_id } = await req.json().catch(() => ({}));
    if (!primary_user_id || !secondary_user_id || primary_user_id === secondary_user_id) {
      return Response.json({ error: 'בחר שני לקוחות שונים לאיחוד' }, { status: 400 });
    }

    const primaryList = await base44.asServiceRole.entities.TeamMember.filter({ id: primary_user_id });
    const secondaryList = await base44.asServiceRole.entities.TeamMember.filter({ id: secondary_user_id });
    const primary = primaryList[0];
    const secondary = secondaryList[0];
    if (!primary || !secondary) return Response.json({ error: 'Client not found' }, { status: 404 });
    if (primary.role !== 'client' || secondary.role !== 'client') return Response.json({ error: 'ניתן לאחד לקוחות בלבד' }, { status: 400 });

    const allEmails = uniqEmails([primary.email, ...(primary.emails || []), secondary.email, ...(secondary.emails || [])]);
    const phone = primary.phone || secondary.phone || '';
    const fullName = primary.full_name || secondary.full_name || '';

    await base44.asServiceRole.entities.TeamMember.update(primary.id, {
      email: allEmails[0],
      emails: allEmails,
      phone,
      full_name: fullName,
      role: 'client',
      is_active: true,
    });

    await base44.asServiceRole.entities.TeamMember.update(secondary.id, {
      is_active: false,
      merged_into_id: primary.id,
      emails: uniqEmails([secondary.email, ...(secondary.emails || [])]),
    });

    const projects = await base44.asServiceRole.entities.Project.list('-created_date', 500);
    let updatedProjects = 0;
    for (const project of projects) {
      const projectEmails = uniqEmails([project.client_email, ...(project.client_emails || [])]);
      const matches = projectEmails.some((email) => allEmails.includes(email));
      if (matches) {
        await base44.asServiceRole.entities.Project.update(project.id, {
          client_name: project.client_name || fullName,
          client_email: allEmails[0],
          client_emails: uniqEmails([...projectEmails, ...allEmails]),
          client_phone: project.client_phone || phone,
        });
        updatedProjects += 1;
      }
    }

    return Response.json({ success: true, mergedClientId: primary.id, emails: allEmails, updatedProjects });
  } catch (error) {
    console.error('mergeClients error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});