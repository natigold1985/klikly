import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeSender(sender) {
  return String(sender || '')
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const phone = normalizeSender(payload.sender);
    const notes = String(payload.query || '').trim();
    const source = 'WhatsApp';

    if (!phone) {
      return Response.json({ success: false, received: true, error: 'sender is required' }, { status: 200 });
    }

    const existing = await base44.asServiceRole.entities.Lead.filter({ phone }, '-created_date', 1);
    let lead;

    if (existing.length > 0) {
      const current = existing[0];
      lead = await base44.asServiceRole.entities.Lead.update(current.id, {
        source,
        notes: [current.notes, notes].filter(Boolean).join('\n'),
        status: current.status || 'new',
        last_contact_date: new Date().toISOString(),
      });
    } else {
      lead = await base44.asServiceRole.entities.Lead.create({
        name: phone,
        phone,
        source,
        notes,
        status: 'new',
        last_contact_date: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, received: true, lead_id: lead.id }, { status: 200 });
  } catch (error) {
    return Response.json({ success: false, received: true, error: error.message }, { status: 200 });
  }
});