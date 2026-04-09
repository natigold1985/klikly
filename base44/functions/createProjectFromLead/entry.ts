import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        const lead = payload.data;
        const oldLead = payload.old_data;
        
        if (!lead) return Response.json({ success: true });

        // Trigger only if status changed to closed_won
        if (lead.status === 'closed_won' && oldLead?.status !== 'closed_won') {
            // Check if project already exists for this lead
            const existing = await base44.asServiceRole.entities.Project.filter({ lead_id: lead.id });
            if (existing.length === 0) {
                await base44.asServiceRole.entities.Project.create({
                    lead_id: lead.id,
                    client_name: lead.name,
                    client_phone: lead.phone,
                    client_email: lead.email,
                    shooting_type: lead.shooting_type,
                    status: 'pending_payment',
                    total_price: lead.budget || 0,
                    created_by: lead.created_by
                });
            }
        }
        
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});