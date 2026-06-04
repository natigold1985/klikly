import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizeIsraeliPhone(phone = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('972') && digits.length >= 11) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (/^[234589]\d{7,8}$/.test(digits)) return `0${digits}`;
  return digits;
}

async function normalizeEntityPhones(base44, entityName, fieldName) {
  const records = await base44.asServiceRole.entities[entityName].list('-created_date', 2000);
  let updated = 0;
  const samples = [];

  for (const record of records) {
    const current = record[fieldName];
    const normalized = normalizeIsraeliPhone(current);
    if (current && normalized && normalized !== current) {
      await base44.asServiceRole.entities[entityName].update(record.id, { [fieldName]: normalized });
      updated++;
      if (samples.length < 10) samples.push({ id: record.id, from: current, to: normalized });
    }
  }

  return { entityName, fieldName, checked: records.length, updated, samples };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const leadResult = await normalizeEntityPhones(base44, 'Lead', 'phone');
    const leadsResult = await normalizeEntityPhones(base44, 'Leads', 'phone_number');

    return Response.json({
      success: true,
      results: [leadResult, leadsResult],
      total_updated: leadResult.updated + leadsResult.updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});