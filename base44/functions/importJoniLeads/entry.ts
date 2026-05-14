import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { leads } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return Response.json({ error: 'No leads to import' }, { status: 400 });
    }

    const pageSize = 500;
    let existing = await base44.asServiceRole.entities.Lead.list('-created_date', pageSize);

    while (existing.length > 0) {
      await Promise.all(existing.map((lead) => base44.asServiceRole.entities.Lead.delete(lead.id)));
      existing = await base44.asServiceRole.entities.Lead.list('-created_date', pageSize);
    }

    await base44.asServiceRole.entities.Lead.bulkCreate(leads.map((lead) => ({
      name: lead.name,
      phone: lead.phone,
      source: 'WhatsApp JONI',
      status: 'new',
      last_contact_date: new Date().toISOString(),
    })));

    return Response.json({ success: true, imported: leads.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});