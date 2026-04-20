import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription, action } = await req.json();

    if (action === 'unsubscribe') {
      // Find and deactivate matching subscription
      const existing = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: user.email,
        endpoint: subscription.endpoint
      });
      for (const sub of existing) {
        await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
      }
      return Response.json({ success: true, action: 'unsubscribed' });
    }

    // Subscribe - check if already exists
    const existing = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: user.email,
      endpoint: subscription.endpoint
    });

    if (existing.length > 0) {
      // Update existing
      await base44.asServiceRole.entities.PushSubscription.update(existing[0].id, {
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        is_active: true,
      });
    } else {
      // Create new
      await base44.asServiceRole.entities.PushSubscription.create({
        user_email: user.email,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        device_label: subscription.deviceLabel || 'Unknown device',
        is_active: true,
      });
    }

    return Response.json({ success: true, action: 'subscribed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});