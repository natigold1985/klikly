import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("airtable");
        const baseId = "appnKzD3XQO9K"; 
        
        // Sync Leads
        let url = `https://api.airtable.com/v0/${baseId}/tblLeads?maxRecords=50`;
        let response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const existingLeads = await base44.asServiceRole.entities.Lead.filter({});
            for (const record of data.records) {
                const match = existingLeads.find(l => l.airtable_record_id === record.id);
                const fields = {
                    name: record.fields["Name"] || "",
                    phone: record.fields["Phone"] || "",
                    email: record.fields["Email"] || "",
                    status: record.fields["Status"] || "new",
                    airtable_record_id: record.id,
                    last_synced_from_airtable: new Date().toISOString()
                };
                
                if (match) {
                    await base44.asServiceRole.entities.Lead.update(match.id, fields);
                } else if (fields.name && fields.phone) {
                    await base44.asServiceRole.entities.Lead.create(fields);
                }
            }
        }

        // Sync Projects
        url = `https://api.airtable.com/v0/${baseId}/tblProjects?maxRecords=50`;
        response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const existingProjects = await base44.asServiceRole.entities.Project.filter({});
            for (const record of data.records) {
                const match = existingProjects.find(p => p.airtable_record_id === record.id);
                const fields = {
                    client_name: record.fields["Client Name"] || "",
                    client_email: record.fields["Client Email"] || "",
                    status: record.fields["Status"] || "pending_payment",
                    airtable_record_id: record.id,
                    last_synced_from_airtable: new Date().toISOString()
                };
                
                let projectId = match ? match.id : null;
                if (match) {
                    await base44.asServiceRole.entities.Project.update(match.id, fields);
                } else if (fields.client_name && fields.client_email) {
                    const newProject = await base44.asServiceRole.entities.Project.create(fields);
                    projectId = newProject.id;
                }

                // If Airtable has a "Photos Status" field, update all selected photos for this project
                const photosStatus = record.fields["Photos Status"];
                if (projectId && photosStatus) {
                    let internalStatus = 'pending';
                    if (photosStatus === 'In-progress' || photosStatus === 'בטיפול') internalStatus = 'in_progress';
                    if (photosStatus === 'Finalized' || photosStatus === 'ערוך') internalStatus = 'finalized';
                    
                    if (internalStatus !== 'pending') {
                        const projectPhotos = await base44.asServiceRole.entities.Photo.filter({ project_id: projectId, is_selected: true });
                        for (const photo of projectPhotos) {
                            if (photo.editing_status !== internalStatus) {
                                await base44.asServiceRole.entities.Photo.update(photo.id, { editing_status: internalStatus });
                            }
                        }
                    }
                }
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});