import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const event = payload.event;
        const record = payload.data;

        if (!record || (record.last_synced_from_airtable && Date.now() - new Date(record.last_synced_from_airtable).getTime() < 10000)) {
            return Response.json({ success: true, message: 'Skipped sync loop' });
        }

        const { accessToken } = await base44.asServiceRole.connectors.getConnection("airtable");
        const baseId = "appnKzD3XQO9K"; 
        const tableId = event.entity_name === 'Lead' ? "tblLeads" : "tblProjects"; 
        
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const fields = event.entity_name === 'Lead' ? {
            "Name": record.name || "",
            "Phone": record.phone || "",
            "Email": record.email || "",
            "Status": record.status || "new",
        } : {
            "Client Name": record.client_name || "",
            "Client Email": record.client_email || "",
            "Status": record.status || "pending_payment"
        };

        let airtableResponse;
        if (event.type === 'create') {
            airtableResponse = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ records: [{ fields }] })
            });
        } else if (event.type === 'update' && record.airtable_record_id) {
            airtableResponse = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ records: [{ id: record.airtable_record_id, fields }] })
            });
        }

        if (airtableResponse && !airtableResponse.ok) {
            console.error("Airtable Sync Error", await airtableResponse.text());
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});