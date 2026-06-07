// Admin utility — deduplicates Lead records by phone number (primary key)
// and by name+source (secondary key). Keeps the OLDEST record per group,
// merges missing fields from duplicates into it, then deletes duplicates.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '').replace(/^972/, '0').replace(/^00972/, '0');
}

function nameSourceKey(lead) {
  const name = String(lead.name || '').trim().toLowerCase();
  const src = String(lead.source || '').trim().toLowerCase();
  if (!name) return '';
  return name + '|' + src;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const all = await base44.asServiceRole.entities.Lead.list('-created_date', 3000);
    console.log(`[cleanDuplicateLeads] loaded ${all.length} leads`);

    // Group by normalized phone first, then fall back to name|source
    const groups = {};
    const seenIds = new Set();

    for (const l of all) {
      const phone = normalizePhone(l.phone);
      const key = phone ? `phone:${phone}` : nameSourceKey(l) ? `ns:${nameSourceKey(l)}` : null;
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }

    let deleted = 0;
    let merged = 0;
    const details = [];

    for (const k of Object.keys(groups)) {
      const grp = groups[k];
      if (grp.length < 2) continue;

      // Keep the OLDEST as canonical
      grp.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const keeper = grp[0];
      const dups = grp.slice(1);

      console.log(`[cleanDuplicateLeads] key="${k}" keeper="${keeper.name}" (${keeper.id}), dups=${dups.length}`);

      // Merge missing fields into keeper
      const updates = {};
      for (const d of dups) {
        if (!keeper.email && d.email) updates.email = d.email;
        if (!keeper.phone && d.phone) updates.phone = d.phone;
        if (!keeper.shooting_type && d.shooting_type) updates.shooting_type = d.shooting_type;
        if (!keeper.address && d.address) updates.address = d.address;
        if (!keeper.notes && d.notes) updates.notes = d.notes;
        if (!keeper.source && d.source) updates.source = d.source;
        if (!keeper.source_post_url && d.source_post_url) updates.source_post_url = d.source_post_url;
      }
      if (Object.keys(updates).length) {
        await base44.asServiceRole.entities.Lead.update(keeper.id, updates);
        merged++;
      }

      // Delete duplicates
      for (const d of dups) {
        if (seenIds.has(d.id)) continue;
        seenIds.add(d.id);
        try {
          await base44.asServiceRole.entities.Lead.delete(d.id);
          deleted++;
          await new Promise(r => setTimeout(r, 80));
        } catch (e) {
          details.push({ id: d.id, name: d.name, error: e.message });
          if (String(e.message || '').toLowerCase().includes('rate')) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
    }

    return Response.json({
      success: true,
      total_leads_checked: all.length,
      duplicate_groups_found: Object.values(groups).filter(g => g.length > 1).length,
      duplicates_deleted: deleted,
      records_merged: merged,
      errors: details,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});