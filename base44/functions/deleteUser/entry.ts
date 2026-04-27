import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return Response.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Fetch the TeamMember to prevent self-deletion and to protect natigold
    const member = await base44.asServiceRole.entities.TeamMember.get(user_id).catch(() => null);
    if (member?.email === admin.email) {
      return Response.json({ error: 'לא ניתן למחוק את עצמך' }, { status: 400 });
    }
    if (member?.email === 'natigold04@gmail.com') {
      return Response.json({ error: 'לא ניתן למחוק את מנהל המערכת הראשי' }, { status: 400 });
    }

    await base44.asServiceRole.entities.TeamMember.delete(user_id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteUser error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});