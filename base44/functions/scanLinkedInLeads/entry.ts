import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use Base44 InvokeLLM to scan LinkedIn for Defense Industry leads
    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt: `סרוק את LinkedIn לאנשים המתעניינים בתעשיית ביטחון בישראל.
      
חפש אנשים עם:
- כותרות משרה בתעשיית ביטחון (חברות תקשורת, סייבר, מערכות הגנה, ציוד צבאי)
- חברות: רפאל, אלביט, טלדוק, סייבר ספארק, וכד'
- אנשים שעבדו בשירותי ביטחון או בתעשיית ההגנה

החזר רשימת JSON עם:
{
  "leads": [
    {
      "name": "שם מלא",
      "title": "כותרת משרה",
      "company": "שם החברה",
      "email": "אימייל אם זמין",
      "phone": "טלפון אם זמין",
      "profileUrl": "קישור LinkedIn",
      "relevanceScore": 1-10
    }
  ],
  "found": מספר,
  "summary": "תיאור"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                title: { type: 'string' },
                company: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                profileUrl: { type: 'string' },
                relevanceScore: { type: 'number' },
              },
            },
          },
          found: { type: 'number' },
          summary: { type: 'string' },
        },
      },
      add_context_from_internet: true,
    });

    const leads = llmResult?.leads || [];
    
    // Optional: Store in PotentialLead entity for tracking
    for (const lead of leads.slice(0, 5)) {
      try {
        await base44.asServiceRole.entities.PotentialLead.create({
          title: `${lead.name} - ${lead.title}`,
          source_url: lead.profileUrl,
          platform: 'linkedin',
          snippet: `${lead.company} - ${lead.title}`,
          keywords_matched: 'תעשיית ביטחון',
          relevance_score: lead.relevanceScore || 8,
          contact_info: `${lead.email || ''} / ${lead.phone || ''}`,
        });
      } catch (e) {
        console.log('Lead already exists or error:', e.message);
      }
    }

    return Response.json({
      success: true,
      leads,
      found: leads.length,
      summary: `סקן LinkedIn הושלם: ${leads.length} לידים חדשים מתעשיית ביטחון`,
    });
  } catch (error) {
    console.error('scanLinkedInLeads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});