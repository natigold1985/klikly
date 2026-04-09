import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        // This is triggered by an entity automation on Task (create/update)
        const task = payload.data;
        if (!task || !task.due_date) return Response.json({ success: true, message: "No due date" });
        
        // Fetch user's calendar connection
        const accessToken = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken("69d3c4ec1ea49d48ce3fec2e");
        
        if (!accessToken) {
            return Response.json({ error: "No calendar connection" }, { status: 400 });
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