// One-time admin utility — deduplicates Lead records that were created by
// system service tokens during sheets sync. Keeps the OLDEST record per
// (name + source) signature and merges email/notes/phone from duplicates
// into the kept one before deleting them.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function key(lead) {
  const name = String(lead.name || '').trim().toLowerCase();
  const src = String(lead.source || '').trim().toLowerCase();
  return name + '|' + src;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pull a generous slice of leads (admin can see all)
    const all = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);

    // Group by signature
    const groups = {};
    for (const l of all) {
      const k = key(l);
      if (!k || k === '|') continue;
      if (!groups[k]) groups[k] = [];
      groups[k].push(l);
    }

    let deleted = 0;
    let merged = 0;
    const details = [];

    for (const k of Object.keys(groups)) {
      const grp = groups[k];
      if (grp.length < 2) continue;

      // Keep the OLDEST one as the canonical record
      grp.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const keeper = grp[0];
      const dups = grp.slice(1);

      // Merge missing fields from duplicates into keeper
      const updates = {};
      for (const d of dups) {
        if (!keeper.email && d.email) updates.email = d.email;
        if (!keeper.phone && d.phone) updates.phone = d.phone;
        if (!keeper.shooting_type && d.shooting_type) updates.shooting_type = d.shooting_type;
        if (!keeper.address && d.address) updates.address = d.address;
        if (!keeper.notes && d.notes) updates.notes = d.notes;
      }
      if (Object.keys(updates).length) {
        await base44.asServiceRole.entities.Lead.update(keeper.id, updates);
        merged++;
      }

      // Delete duplicates (with small delay to respect rate limits)
      for (const d of dups) {
        try {
          await base44.asServiceRole.entities.Lead.delete(d.id);
          deleted++;
          await new Promise(r => setTimeout(r, 80));
        } catch (e) {
          details.push({ id: d.id, error: e.message });
          // back off harder on rate-limit
          if (String(e.message || '').toLowerCase().includes('rate')) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
    }

    return Response.json({
      success: true,
      total_groups_processed: Object.keys(groups).length,
      duplicates_deleted: deleted,
      records_merged: merged,
      errors: details,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});