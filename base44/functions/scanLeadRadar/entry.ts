import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const customKeywords = body.keywords || [];

    const defaultKeywords = [
      'דרוש צלם אירועים',
      'מחפשת צלמת לחתונה',
      'מכרז צילום',
      'צלם לאירוע',
      'מחפשים צלם לבר מצווה',
      'photographer needed Israel',
      'wedding photographer Tel Aviv',
    ];

    const keywords = [...defaultKeywords, ...customKeywords];
    const searchQuery = keywords.slice(0, 5).join(' OR ');

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a lead generation assistant for a professional photographer in Israel.

Search the web for RECENT posts, ads, or discussions where people are looking for a photographer.
Focus on Hebrew and English content from Israel.

Search terms: ${searchQuery}

For each result found, extract:
- title: the post title or first line
- platform: one of "facebook", "instagram", "linkedin", "forum", "job_board", "other"
- snippet: a short excerpt (2-3 sentences max) in the original language
- source_url: the URL if available, or "N/A"
- keywords_matched: which keywords matched
- relevance_score: 1-10 how relevant this is for a photographer
- contact_info: any contact details found (phone, email, name) or "N/A"

Return 5-10 results, sorted by relevance_score descending.
Only include results from the last 30 days if possible.
Focus on actual people looking for photographers, not photographer portfolios or ads BY photographers.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                platform: { type: 'string' },
                snippet: { type: 'string' },
                source_url: { type: 'string' },
                keywords_matched: { type: 'string' },
                relevance_score: { type: 'number' },
                contact_info: { type: 'string' },
              }
            }
          },
          scan_summary: { type: 'string' }
        }
      }
    });

    // Save discovered leads to PotentialLead entity
    const discoveredLeads = result.leads || [];
    let saved = 0;

    if (discoveredLeads.length > 0) {
      // Get existing potential leads to avoid duplicates
      const existing = await base44.entities.PotentialLead.filter({}, '-created_date', 100);
      const existingTitles = new Set(existing.map(e => e.title?.toLowerCase().trim()));

      const newLeads = discoveredLeads.filter(l => 
        l.title && !existingTitles.has(l.title.toLowerCase().trim())
      );

      if (newLeads.length > 0) {
        const validPlatforms = ['facebook', 'instagram', 'linkedin', 'forum', 'job_board', 'other'];
        await base44.entities.PotentialLead.bulkCreate(
          newLeads.map(l => ({
            title: l.title.substring(0, 200),
            platform: validPlatforms.includes(l.platform) ? l.platform : 'other',
            snippet: l.snippet?.substring(0, 500) || '',
            source_url: l.source_url || '',
            keywords_matched: l.keywords_matched || '',
            relevance_score: Math.min(10, Math.max(1, l.relevance_score || 5)),
            contact_info: l.contact_info || '',
            status: 'new',
          }))
        );
        saved = newLeads.length;
      }
    }

    return Response.json({
      success: true,
      found: discoveredLeads.length,
      saved,
      summary: result.scan_summary || `סריקה הושלמה: ${discoveredLeads.length} תוצאות`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});