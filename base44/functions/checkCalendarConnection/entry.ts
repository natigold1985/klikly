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

        // Just fetching primary calendar to verify connection
        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to verify calendar');
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 400 });
    }
});