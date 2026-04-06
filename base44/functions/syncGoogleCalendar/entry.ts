import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const connectorId = "69d3c4ec1ea49d48ce3fec2e";
        const accessToken = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(connectorId);
        
        if (!accessToken) {
            return Response.json({ error: 'Not connected' }, { status: 400 });
        }

        // Sync logic: Fetch upcoming events from Google Calendar
        const timeMin = new Date().toISOString();
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=50&singleEvents=true&orderBy=startTime`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch calendar events');
        }

        const data = await response.json();
        const events = data.items || [];
        
        // Let's also sync our Projects back to Google Calendar
        const projects = await base44.entities.Project.filter({ created_by: user.email });
        
        let syncedCount = 0;
        for (const proj of projects) {
            if (proj.shooting_date) {
                // Check if event already exists for this project
                const eventExists = events.find(e => e.summary && e.summary.includes(proj.client_name));
                
                if (!eventExists) {
                    const eventDate = new Date(proj.shooting_date);
                    const endDate = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000); // assume 4 hours
                    
                    const newEvent = {
                        summary: `צילומים: ${proj.client_name}`,
                        description: `סוג צילום: ${proj.shooting_type}\nטלפון: ${proj.client_phone}`,
                        start: {
                            dateTime: eventDate.toISOString(),
                        },
                        end: {
                            dateTime: endDate.toISOString(),
                        }
                    };
                    
                    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(newEvent)
                    });
                    syncedCount++;
                }
            }
        }

        return Response.json({ success: true, eventsCount: events.length, syncedToCalendar: syncedCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 400 });
    }
});