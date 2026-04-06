import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = await req.json();
        const { leadId, projectId, templateName } = payload;
        
        let record, tableId;
        if (leadId) {
            record = await base44.entities.Lead.get(leadId);
            tableId = "tblLeads";
        } else if (projectId) {
            record = await base44.entities.Project.get(projectId);
            tableId = "tblProjects";
        }

        if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
        
        const airtableRecordId = record.airtable_record_id || "mock_id";
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("airtable");
        
        const baseId = "appnKzD3XQO9K"; 
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const recordData = {
            id: airtableRecordId,
            fields: {
                "Trigger_WhatsApp": true,
                "WhatsApp_Template": templateName || "Default"
            }
        };

        if (airtableRecordId !== "mock_id") {
            const response = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ records: [recordData] })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Airtable API Error:", errText);
            }
        } else {
            console.log("Mocking Airtable API Trigger for record ID:", record.id);
        }

        return Response.json({ success: true, message: 'WhatsApp automation triggered in Airtable' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});