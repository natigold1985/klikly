import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizePhone(raw) {
  if (!raw) return '';
  // Keep digits only, then prepend +
  const digits = String(raw).replace(/[^0-9]/g, '');
  return '+' + digits;
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Authenticate via x-api-key header
  const apiKey = req.headers.get('x-api-key');
  const secret = Deno.env.get('LEADS_SECRET');
  if (!apiKey || apiKey !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { phone, name, source, labeledAt } = body;

  // Validate required field
  if (!phone) {
    return Response.json({ error: 'Missing required field: phone' }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);

  // Use service role — no authenticated user in this webhook flow
  const base44 = createClientFromRequest(req);

  // Deduplication check
  const existing = await base44.asServiceRole.entities.Lead.filter({}, '-created_date', 2000);
  const duplicate = existing.find(l => normalizePhone(l.phone) === normalizedPhone);

  if (duplicate) {
    return Response.json({ status: 'exists', id: duplicate.id }, { status: 200 });
  }

  // Create new lead
  const createdAt = labeledAt || new Date().toISOString();
  const newLead = await base44.asServiceRole.entities.Lead.create({
    phone: normalizedPhone,
    name: name || '',
    source: source || 'whatsapp',
    status: 'ליד חדש',
    last_contact_date: createdAt,
  });

  return Response.json({ status: 'created', id: newLead.id }, { status: 201 });
});