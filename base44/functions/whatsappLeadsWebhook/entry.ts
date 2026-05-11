import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const phone = String(payload.phone || '').trim();
    if (!phone) {
      return Response.json({ error: 'phone is required' }, { status: 400 });
    }

    const lead = await base44.asServiceRole.entities.Leads.create({
      phone_number: phone,
      first_name: String(payload.first_name || '').trim(),
      full_name_notes: String(payload.full_name || '').trim(),
      source: String(payload.source || '').trim(),
      status: 'New Lead',
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, lead_id: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});