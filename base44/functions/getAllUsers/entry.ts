import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return TeamMember records — these are the source of truth for access
    const teamMembers = await base44.asServiceRole.entities.TeamMember.list('-created_date', 500);
    return Response.json({ users: teamMembers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});