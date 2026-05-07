import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // Extract structured data from file
    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                shooting_type: { type: 'string' },
                source: { type: 'string' },
                event_date: { type: 'string' },
                budget: { type: 'number' },
                notes: { type: 'string' },
                address: { type: 'string' },
              }
            }
          }
        }
      }
    });

    if (extracted.status !== 'success' || !extracted.output?.leads) {
      return Response.json({ error: extracted.details || 'Failed to extract data' }, { status: 400 });
    }

    const rows = extracted.output.leads.filter(l => {
      const text = [l.name, l.source, l.notes, l.shooting_type].filter(Boolean).join(' ').toLowerCase();
      const phoneDigits = String(l.phone || '').replace(/[^0-9]/g, '');
      const hasRealPhone = phoneDigits.length >= 9 && phoneDigits.length <= 13;
      const hasRealName = l.name && !['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?'].includes(String(l.name).trim().toLowerCase());
      const isMarketingOrCourse = /photography-course|קורס צילום|קורס|שבעה ימים להבין הכל|אני נתי גולד|צרו קשר|landing page/i.test(text);
      return hasRealName && hasRealPhone && !isMarketingOrCourse;
    });
    if (rows.length === 0) {
      return Response.json({ error: 'No real leads found (need real name + valid phone)' }, { status: 400 });
    }

    // Fetch existing leads for dedup (scoped to user)
    const existing = await base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 500);
    const phoneMap = {};
    const emailMap = {};
    for (const lead of existing) {
      if (lead.phone) phoneMap[lead.phone.replace(/[^0-9]/g, '')] = lead;
      if (lead.email) emailMap[lead.email.toLowerCase()] = lead;
    }

    let added = 0;
    let updated = 0;

    for (const row of rows) {
      const cleanPhone = (row.phone || '').replace(/[^0-9]/g, '');
      const cleanEmail = (row.email || '').toLowerCase().trim();

      // Check for existing by phone or email
      const match = phoneMap[cleanPhone] || (cleanEmail ? emailMap[cleanEmail] : null);

      if (match) {
        // Upsert: update with new non-empty fields
        const updates = {};
        if (row.shooting_type && !match.shooting_type) updates.shooting_type = row.shooting_type;
        if (row.source && !match.source) updates.source = row.source;
        if (row.event_date && !match.event_date) updates.event_date = row.event_date;
        if (row.budget && !match.budget) updates.budget = row.budget;
        if (row.notes && !match.notes) updates.notes = row.notes;
        if (row.address && !match.address) updates.address = row.address;
        if (row.email && !match.email) updates.email = row.email;

        if (Object.keys(updates).length > 0) {
          await base44.entities.Lead.update(match.id, updates);
          updated++;
        }
      } else {
        // Insert new
        await base44.entities.Lead.create({
          name: row.name,
          phone: row.phone,
          email: row.email || undefined,
          shooting_type: row.shooting_type || undefined,
          source: row.source || 'CSV Import',
          event_date: row.event_date || undefined,
          budget: row.budget || undefined,
          notes: row.notes || undefined,
          address: row.address || undefined,
          status: 'new',
          last_contact_date: new Date().toISOString(),
        });
        added++;
      }
    }

    // Notify user about credit usage (ExtractDataFromUploadedFile uses AI credits)
    try {
      await base44.asServiceRole.functions.invoke('notifyCreditUsage', {
        user_email: user.email,
        operation: 'ייבוא לידים מקובץ (AI)',
        details: `${rows.length} שורות עובדו, ${added} חדשים`,
      });
    } catch (e) { /* non-blocking */ }

    return Response.json({ success: true, added, updated, total_processed: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});