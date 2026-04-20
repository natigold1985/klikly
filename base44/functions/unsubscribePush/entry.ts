import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await req.json();

    const existing = await base44.entities.PushSubscription.filter({
      endpoint: endpoint,
      user_email: user.email
    });

    for (const sub of existing) {
      await base44.entities.PushSubscription.update(sub.id, { is_active: false });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});