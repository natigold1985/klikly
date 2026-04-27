import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Self-approval endpoint: when an authenticated user opens the app for the first
// time, the frontend calls this to grant them access (is_invited=true) immediately.
// The system is now open — every authenticated user is approved automatically.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (me.is_invited === true) {
      return Response.json({ success: true, alreadyApproved: true });
    }

    await base44.asServiceRole.entities.User.update(me.id, { is_invited: true });
    return Response.json({ success: true, approved: true });
  } catch (error) {
    console.error('autoApproveNewUser error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});