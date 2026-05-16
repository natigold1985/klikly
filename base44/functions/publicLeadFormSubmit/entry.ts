import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { name, phone, notes } = await req.json();
    if (!name || !phone) return Response.json({ error: 'name and phone are required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.create({
      name,
      phone: String(phone).replace(/[^0-9]/g, ''),
      notes: notes || '',
      source: 'Website',
      status: 'new',
      last_contact_date: new Date().toISOString(),
    });

    return Response.json({ success: true, lead });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});