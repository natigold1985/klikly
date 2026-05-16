import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanPhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const source = body.source || body.platform || 'Facebook';
    const name = body.name || body.full_name || body.first_name || body.lead?.name;
    const phone = cleanPhone(body.phone || body.phone_number || body.mobile || body.lead?.phone);
    const notes = body.notes || body.message || body.form_name || JSON.stringify(body);

    if (!phone) {
      return Response.json({ error: 'phone is required' }, { status: 400 });
    }

    const lead = await base44.asServiceRole.entities.Lead.create({
      name: name || phone,
      phone,
      notes,
      source: String(source).toLowerCase().includes('instagram') ? 'Instagram' : 'Facebook',
      status: 'new',
      last_contact_date: new Date().toISOString(),
    });

    return Response.json({ success: true, lead });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});