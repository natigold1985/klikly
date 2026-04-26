import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { user_id, role, assigned_photographer_email } = await req.json();
    if (!user_id || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['admin', 'user', 'client'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const updateData = { role };
    if (role === 'client') {
      updateData.assigned_photographer_email = assigned_photographer_email || null;
    } else {
      updateData.assigned_photographer_email = null;
    }

    await base44.asServiceRole.entities.User.update(user_id, updateData);
    return Response.json({ success: true });
  } catch (error) {
    console.error('updateUserRole error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});