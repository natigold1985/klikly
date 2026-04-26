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

    // Prevent deleting yourself
    if (user_id === admin.id) {
      return Response.json({ error: 'לא ניתן למחוק את עצמך' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.delete(user_id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteUser error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});