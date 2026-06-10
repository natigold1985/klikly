import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '').slice(-10);
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 10000);
    
    const seen = {};
    const duplicates = [];
    const toDelete = [];

    for (const lead of allLeads) {
      const phone = normalizePhone(lead.phone);
      const email = normalizeEmail(lead.email);
      const key = `${phone}|${email}`;

      if (key && key !== '|') {
        if (seen[key]) {
          duplicates.push({ leadId: lead.id, duplicate_of: seen[key], key });
          toDelete.push(lead.id);
        } else {
          seen[key] = lead.id;
        }
      }
    }

    // Delete duplicates (keep first occurrence)
    for (const leadId of toDelete) {
      await base44.asServiceRole.entities.Lead.delete(leadId);
    }

    return Response.json({
      success: true,
      total_leads: allLeads.length,
      duplicates_found: duplicates.length,
      duplicates_deleted: toDelete.length,
      duplicates,
    });
  } catch (error) {
    console.error('validateLeadDuplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});