import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const leads = await base44.asServiceRole.entities.Lead.filter({});
        const today = new Date();
        let emailsSent = 0;

        for (const lead of leads) {
            if (lead.event_date && lead.email && lead.shooting_type?.includes('חתונה')) {
                const eventDate = new Date(lead.event_date);
                if (eventDate.getMonth() === today.getMonth() && eventDate.getDate() === today.getDate() && eventDate.getFullYear() < today.getFullYear()) {
                    const years = today.getFullYear() - eventDate.getFullYear();
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: lead.email,
                        subject: `יום נישואין ${years} שמח! 🎉`,
                        body: `היי ${lead.name},\n\nרצינו לאחל לכם יום נישואין ${years} שמח! 🥳\nנשמח לעמוד לשירותכם תמיד בסטודיו.\n\nבברכה,\nNati Gold Studio`
                    });
                    emailsSent++;
                }
            }
        }
        
        return Response.json({ success: true, emailsSent });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});