import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
        user = await base44.auth.me();
    } catch (e) {
        user = null;
    }
    const { path, details } = await req.json();

    const actor = user ? `User ${user.email} (Role: ${user.role})` : 'Unauthenticated visitor';

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'security_violation',
      details: `[403 Access Denied] ${actor} attempted to access path: ${path}. ${details || ''}`,
      status: 'error',
      owner_id: user?.id || null
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});