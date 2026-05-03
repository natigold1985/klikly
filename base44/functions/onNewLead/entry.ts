import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Triggered when a new Lead is created.
// Sends a Push Notification to the lead owner (no email = no credits).
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const payload = await req.json();
        const lead = payload.data;
        if (!lead) return Response.json({ success: true, message: 'No lead data' });

        // Log the action
        await base44.asServiceRole.entities.SystemLog.create({
            action: 'Lead Created Automation',
            details: `Push notification sent for new lead ${lead.name} (${lead.phone})`,
            status: 'success',
            related_entity_type: 'Lead',
            related_entity_id: lead.id,
            owner_id: lead.created_by
        });

        // Send PUSH (not email) to the photographer
        if (lead.created_by) {
            const vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
            const vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();

            if (vapidPublic && vapidPrivate) {
                webpush.setVapidDetails('mailto:' + lead.created_by, vapidPublic, vapidPrivate);

                const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
                    user_email: lead.created_by,
                    is_active: true,
                });

                const pushPayload = JSON.stringify({
                    title: `🎯 ליד חדש: ${lead.name || 'ללא שם'}`,
                    body: `${lead.shooting_type ? lead.shooting_type + ' • ' : ''}${lead.phone || ''}${lead.source ? ' • מ' + lead.source : ''}`,
                    icon: '/icon-192.png',
                    url: `/Leads`,
                });

                for (const sub of subscriptions) {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
                            pushPayload
                        );
                    } catch (err) {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
                        }
                    }
                }
            }
        }

        return Response.json({ success: true, message: 'Push sent' });
    } catch (error) {
        console.error("Lead Automation Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});