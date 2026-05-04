// One-time / on-demand job: scans existing leads of the calling user and marks
// junk leads (invalid phone / placeholder name) as is_filtered=true.
// Safe to re-run — only updates leads that need a status change.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const leads = await base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 1000);

    const junkNames = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא'];
    let markedFiltered = 0;
    let markedClean = 0;

    for (const lead of leads) {
      const name = String(lead.name || '').trim();
      const lowName = name.toLowerCase();
      const digits = String(lead.phone || '').replace(/[^0-9]/g, '');

      const isInvalidPhone = !digits || digits.length < 9 || digits.length > 13;
      const isPlaceholderName = !name || junkNames.some(j => lowName === j) || lowName.includes('ליד ללא שם');
      const shouldBeFiltered = isInvalidPhone || isPlaceholderName;
      const reason = isInvalidPhone ? 'invalid_phone' : (isPlaceholderName ? 'no_name' : null);

      if (shouldBeFiltered && !lead.is_filtered) {
        await base44.entities.Lead.update(lead.id, { is_filtered: true, filter_reason: reason });
        markedFiltered++;
      } else if (!shouldBeFiltered && lead.is_filtered) {
        // unmark previously filtered lead that now passes (e.g. phone fixed manually)
        await base44.entities.Lead.update(lead.id, { is_filtered: false, filter_reason: null });
        markedClean++;
      }
    }

    return Response.json({
      success: true,
      total_scanned: leads.length,
      newly_filtered: markedFiltered,
      newly_unfiltered: markedClean,
    });
  } catch (error) {
    console.error('markExistingJunkLeads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});