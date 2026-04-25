import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const payload = await req.json();
        const lead = payload.data;
        if (!lead) return Response.json({ success: true, message: 'No lead data' });

        // Log the action to SystemLogs
        await base44.asServiceRole.entities.SystemLog.create({
            action: 'Lead Created Automation',
            details: `Simulated WhatsApp and Email sent to ${lead.name} (${lead.phone})`,
            status: 'success',
            related_entity_type: 'Lead',
            related_entity_id: lead.id,
            owner_id: lead.created_by
        });

        // Simulating the WhatsApp message via logging (as requested in efficiency prompt)
        console.log(`[WhatsApp API Simulated 019] to ${lead.phone}: היי ${lead.name}, ראינו שהתעניינת. מעבירים אליך פרטים.`);

        // Send notification email to the photographer (app user), not the lead
        if (lead.created_by) {
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: lead.created_by,
                    subject: `ליד חדש: ${lead.name}`,
                    body: `ליד חדש נוסף למערכת!\n\nשם: ${lead.name}\nטלפון: ${lead.phone}\nאימייל: ${lead.email || 'לא צוין'}\nסוג צילום: ${lead.shooting_type || 'לא צוין'}\nמקור: ${lead.source || 'לא צוין'}`
                });
            } catch (emailErr) {
                console.warn("Could not send notification email:", emailErr.message);
            }
        }

        return Response.json({ success: true, message: 'Automations triggered successfully' });
    } catch (error) {
        console.error("Lead Automation Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});