import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const projects = await base44.asServiceRole.entities.Project.filter({});
        const leads = await base44.asServiceRole.entities.Lead.filter({});
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        let alertsSent = 0;

        for (const proj of projects) {
            if (proj.shooting_date) {
                const eventDate = new Date(proj.shooting_date);
                const timeDiffHours = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                if ((timeDiffHours > 23 && timeDiffHours <= 24) || (timeDiffHours > 0 && timeDiffHours <= 1)) {
                    const alertType = timeDiffHours > 1 ? "24 שעות" : "שעה";
                    
                    // Log activity or send email instead of push notification (as push is not native)
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: user.email,
                        subject: `תזכורת: אירוע מתקרב בעוד ${alertType}! 📸`,
                        body: `היי,\n\nהאירוע של ${proj.client_name} מתקרב ויתקיים בעוד ${alertType}.\nסוג צילום: ${proj.shooting_type}\n\nבהצלחה,\nKlikly OS`
                    });
                    alertsSent++;
                }
            }
        }
        
        return Response.json({ success: true, alertsSent });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});