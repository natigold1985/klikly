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

    const { user_id, emails } = await req.json().catch(() => ({}));
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

    const users = await base44.asServiceRole.entities.TeamMember.filter({ id: user_id });
    const client = users[0];
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const allEmails = uniqEmails([client.email, ...(client.emails || []), ...(emails || [])]);
    if (!allEmails.length) return Response.json({ error: 'At least one email required' }, { status: 400 });

    await base44.asServiceRole.entities.TeamMember.update(client.id, {
      email: allEmails[0],
      emails: allEmails,
    });

    const projects = await base44.asServiceRole.entities.Project.list('-created_date', 500);
    let updatedProjects = 0;
    for (const project of projects) {
      const projectEmails = uniqEmails([project.client_email, ...(project.client_emails || [])]);
      const matches = projectEmails.some((email) => allEmails.includes(email));
      if (matches) {
        await base44.asServiceRole.entities.Project.update(project.id, {
          client_email: allEmails[0],
          client_emails: uniqEmails([...projectEmails, ...allEmails]),
        });
        updatedProjects += 1;
      }
    }

    return Response.json({ success: true, emails: allEmails, updatedProjects });
  } catch (error) {
    console.error('updateClientEmails error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});