import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

    const normalized = email.trim().toLowerCase();
    const users = await base44.asServiceRole.entities.User.filter({ email: normalized });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    await base44.asServiceRole.entities.User.update(user.id, { is_invited: true });

    // Verify
    const verified = await base44.asServiceRole.entities.User.filter({ email: normalized });
    return Response.json({
      success: true,
      before: user.is_invited,
      after: verified[0]?.is_invited,
      user_id: user.id,
    });
  } catch (error) {
    console.error('grantUserAccess error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});