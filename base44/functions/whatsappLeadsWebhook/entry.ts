import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9+]/g, '').trim();
}

function normalizeSource(source) {
  const value = String(source || '').trim();
  return value || 'WhatsApp';
}

function isCourseLead(source, notes) {
  const text = `${source || ''} ${notes || ''}`.toLowerCase();
  return text.includes('course') || text.includes('קורס') || text.includes('לימודי צילום');
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const phone = normalizePhone(payload.phone);

    if (!phone) {
      return Response.json({ error: 'phone is required' }, { status: 400 });
    }

    const source = normalizeSource(payload.source || 'WhatsApp');
    const firstName = String(payload.first_name || '').trim();
    const fullName = String(payload.full_name || '').trim();
    const name = fullName || firstName || phone;
    const notes = String(payload.notes || fullName || '').trim();
    const shootingType = isCourseLead(source, notes) ? 'קורס צילום' : String(payload.shooting_type || '').trim();

    const existing = await base44.asServiceRole.entities.Lead.filter({ phone }, '-created_date', 1);
    let lead;

    if (existing.length > 0) {
      const current = existing[0];
      lead = await base44.asServiceRole.entities.Lead.update(current.id, {
        name: current.name || name,
        source: current.source || source,
        shooting_type: current.shooting_type || shootingType,
        notes: [current.notes, notes].filter(Boolean).join('\n'),
        status: current.status || 'new',
        last_contact_date: new Date().toISOString(),
      });
    } else {
      lead = await base44.asServiceRole.entities.Lead.create({
        name,
        phone,
        source,
        shooting_type: shootingType,
        notes,
        status: 'new',
        last_contact_date: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, lead_id: lead.id, source });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});