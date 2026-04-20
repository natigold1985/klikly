import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription, deviceLabel } = await req.json();

    // Check if this endpoint already exists
    const existing = await base44.entities.PushSubscription.filter({
      endpoint: subscription.endpoint
    });

    if (existing.length > 0) {
      // Update existing
      await base44.entities.PushSubscription.update(existing[0].id, {
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        user_email: user.email,
        device_label: deviceLabel || 'Unknown',
        is_active: true
      });
      return Response.json({ success: true, updated: true });
    }

    // Create new
    await base44.entities.PushSubscription.create({
      user_email: user.email,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
      device_label: deviceLabel || 'Unknown',
      is_active: true
    });

    return Response.json({ success: true, created: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});