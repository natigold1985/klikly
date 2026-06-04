import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanPhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return '';
  if (digits.startsWith('972') && digits.length >= 11) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (/^[234589]\d{7,8}$/.test(digits)) return `0${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await req.json();
    if (!String(text || '').trim()) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract CRM leads from this raw WhatsApp/JONI Hebrew text.\n\nRules:\n- Identify Hebrew names, phone numbers, and notes/context.\n- Keep phone numbers as clean Israeli digits. If a mobile misses the leading 0, add it.\n- Return only rows with a valid phone number.\n- name should be the best Hebrew display name.\n- notes should include any extra descriptive text/labels from the row.\n\nRaw text:\n${text}`,
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const extracted = Array.isArray(result?.leads) ? result.leads : [];
    const existing = await base44.entities.Lead.list('-created_date', 1000);
    const existingPhones = new Set(existing.map((lead) => cleanPhone(lead.phone)).filter(Boolean));
    const seenPhones = new Set();
    const now = new Date().toISOString();

    const leadsToCreate = extracted
      .map((lead) => ({
        name: String(lead.name || '').trim(),
        phone: cleanPhone(lead.phone),
        notes: String(lead.notes || '').trim(),
        source: 'JONI',
        status: 'new',
        last_contact_date: now,
      }))
      .filter((lead) => lead.phone && lead.name)
      .filter((lead) => {
        if (existingPhones.has(lead.phone) || seenPhones.has(lead.phone)) return false;
        seenPhones.add(lead.phone);
        return true;
      });

    if (leadsToCreate.length > 0) {
      await base44.entities.Lead.bulkCreate(leadsToCreate);
    }

    return Response.json({
      success: true,
      added: leadsToCreate.length,
      skipped: extracted.length - leadsToCreate.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});