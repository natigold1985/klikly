import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        // This is triggered by an entity automation on Task (create/update)
        const task = payload.data;
        if (!task || !task.due_date) return Response.json({ success: true, message: "No due date" });
        
        // Fetch user's calendar connection — skip silently if not connected
        let accessToken;
        try {
            const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
            accessToken = conn?.accessToken;
        } catch (_) {
            return Response.json({ success: true, skipped: 'calendar_not_connected' });
        }

        if (!accessToken) {
            return Response.json({ success: true, skipped: 'calendar_not_connected' });
        }

        const event = {
            summary: `משימה: ${task.title}`,
            description: task.description || '',
            start: {
                dateTime: new Date(task.due_date).toISOString(),
            },
            end: {
                dateTime: new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
            }
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        const data = await response.json();
        return Response.json({ success: true, eventId: data.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});