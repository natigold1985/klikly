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
    
    const phoneMap = {};
    const emailMap = {};
    const duplicates = [];
    const toDelete = [];

    for (const lead of allLeads) {
      const phone = normalizePhone(lead.phone);
      const email = normalizeEmail(lead.email);
      const existingByPhone = phone ? phoneMap[phone] : null;
      const existingByEmail = email ? emailMap[email] : null;
      const keeper = existingByPhone || existingByEmail;

      if (keeper) {
        const updates = {};
        if (!keeper.name && lead.name) updates.name = lead.name;
        if (!keeper.phone && lead.phone) updates.phone = lead.phone;
        if (!keeper.email && lead.email) updates.email = lead.email;
        if (!keeper.source && lead.source) updates.source = lead.source;
        if (!keeper.source_post_url && lead.source_post_url) updates.source_post_url = lead.source_post_url;
        if (!keeper.shooting_type && lead.shooting_type) updates.shooting_type = lead.shooting_type;
        if (!keeper.notes && lead.notes) updates.notes = lead.notes;
        if (!keeper.status && lead.status) updates.status = lead.status;

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Lead.update(keeper.id, updates);
          Object.assign(keeper, updates);
        }

        duplicates.push({
          leadId: lead.id,
          duplicate_of: keeper.id,
          match_by: [phone && existingByPhone ? 'phone' : null, email && existingByEmail ? 'email' : null].filter(Boolean).join('+'),
          phone,
          email,
        });
        toDelete.push(lead.id);
        continue;
      }

      if (phone) phoneMap[phone] = lead;
      if (email) emailMap[email] = lead;
    }

    // Delete duplicates (same phone OR same email), keeping the newest record and merging missing details into it.
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