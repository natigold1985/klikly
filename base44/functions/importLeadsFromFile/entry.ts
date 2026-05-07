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
                source_post_url: { type: 'string' },
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
      const text = [l.name, l.source, l.source_post_url, l.notes, l.shooting_type].filter(Boolean).join(' ').toLowerCase();
      const phoneDigits = String(l.phone || '').replace(/[^0-9]/g, '');
      const hasRealPhone = phoneDigits.length === 10 && !/^(\d)\1+$/.test(phoneDigits);
      const hasRealEmail = !!(l.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(l.email).trim()));
      const hasFullName = String(l.name || '').trim().split(/\s+/).filter(Boolean).length >= 2;
      const sourceUrl = l.source_post_url || (text.match(/https?:\/\/[^\s|,]+/i) || [])[0] || '';
      const hasSourceUrl = /^https?:\/\//i.test(sourceUrl);
      const isMarketingOrCourse = /photography-course|קורס צילום|קורס|שבעה ימים להבין הכל|אני נתי גולד|צרו קשר|landing page/i.test(text);
      const isBadLinkedIn = text.includes('linkedin') && !hasRealPhone && !hasRealEmail;
      return hasFullName && (hasRealPhone || hasRealEmail) && hasSourceUrl && !isMarketingOrCourse && !isBadLinkedIn;
    });
    if (rows.length === 0) {
      return Response.json({ error: 'No real leads found (need full name + valid phone/email + source URL)' }, { status: 400 });
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

    const classifyPipeline = (row) => {
      const text = [row.source, row.source_post_url, row.notes, row.shooting_type].filter(Boolean).join(' ').toLowerCase();
      if (/רפאל|אלביט|תעא|תעשייה אווירית|iai|rafael|elbit|defense|ביטחון|ביטחונית/.test(text)) {
        return { pipeline: 'defense_industry', pipeline_stage: 'lead_found' };
      }
      if (/webinar|וובינר|ai|בינה מלאכותית|תדמית ai/.test(text)) {
        return { pipeline: 'ai_webinar', pipeline_stage: 'registered_webinar' };
      }
      return { pipeline: 'events_b2b', pipeline_stage: 'quote_sent' };
    };

    for (const row of rows) {
      const cleanPhone = (row.phone || '').replace(/[^0-9]/g, '');
      const cleanEmail = (row.email || '').toLowerCase().trim();

      // Check for existing by phone or email
      const match = phoneMap[cleanPhone] || (cleanEmail ? emailMap[cleanEmail] : null);

      const sourceUrl = row.source_post_url || ([row.source, row.notes].filter(Boolean).join(' ').match(/https?:\/\/[^\s|,]+/i) || [])[0] || '';
      const pipelineData = classifyPipeline(row);

      if (match) {
        // Upsert: update with new non-empty fields
        const updates = {};
        if (row.shooting_type && !match.shooting_type) updates.shooting_type = row.shooting_type;
        if (row.source && !match.source) updates.source = row.source;
        if (sourceUrl && !match.source_post_url) updates.source_post_url = sourceUrl;
        if (!match.pipeline) updates.pipeline = pipelineData.pipeline;
        if (!match.pipeline_stage) updates.pipeline_stage = pipelineData.pipeline_stage;
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
          source_post_url: sourceUrl,
          pipeline: pipelineData.pipeline,
          pipeline_stage: pipelineData.pipeline_stage,
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