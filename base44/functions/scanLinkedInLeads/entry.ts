import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const DEFENSE_TAB = 'לידים ביטחון 🎯';
const HEADERS = ['שם מלא', 'תפקיד', 'חברה', 'טלפון', 'מייל', 'קישור LinkedIn', 'סטטוס', 'תאריך'];

function isValidLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  // Must contain linkedin.com/in/ with an actual profile slug
  return /linkedin\.com\/in\/[a-z0-9\-_%]{3,}/.test(clean);
}

async function syncToSheet(authHeader, leads) {
  // Check if headers exist
  const encTab = encodeURIComponent(`'${DEFENSE_TAB}'!A1:H2`);
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encTab}`,
    { headers: authHeader }
  );
  const checkData = await checkRes.json();
  const hasHeaders = (checkData.values || []).length > 0;

  if (!hasHeaders) {
    const headerRange = encodeURIComponent(`'${DEFENSE_TAB}'!A1:H1`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [HEADERS] }),
      }
    );
  }

  const today = new Date().toLocaleDateString('he-IL');
  const rows = leads.map(lead => [
    lead.name || '',
    lead.title || '',
    lead.company || '',
    lead.phone || '',
    lead.email || '',
    lead.profileUrl || '',
    'ליד חדש',
    today,
  ]);

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${DEFENSE_TAB}'!A:H`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  });

  if (!appendRes.ok) {
    const err = await appendRes.text();
    console.error('syncToSheet failed:', err);
    throw new Error(`Sheet sync failed: ${err}`);
  }

  return rows.length;
}

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
- חברות: רפאל, אלביט, טלדוק, סייבר ספארק, IAI, Elta, Soltam, וכד'
- אנשים שעבדו בשירותי ביטחון או בתעשיית ההגנה

חשוב מאוד: 
- החזר רק אנשים שיש להם פרופיל LinkedIn אמיתי עם URL תקין בפורמט: https://www.linkedin.com/in/PROFILE-SLUG
- אל תכלול אנשים ללא URL תקין של פרופיל LinkedIn
- ה-URL חייב להכיל linkedin.com/in/ ואחריו שם פרופיל אמיתי (לא /search, /company וכו')

החזר רשימת JSON עם:
{
  "leads": [
    {
      "name": "שם מלא",
      "title": "כותרת משרה",
      "company": "שם החברה",
      "email": "אימייל אם זמין",
      "phone": "טלפון אם זמין",
      "profileUrl": "https://www.linkedin.com/in/profile-slug (חובה!)",
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

    const allLeads = llmResult?.leads || [];

    // Filter: only leads with a valid LinkedIn URL
    const validLeads = allLeads.filter(lead => isValidLinkedInUrl(lead.profileUrl));
    const invalidCount = allLeads.length - validLeads.length;

    if (invalidCount > 0) {
      console.log(`Filtered out ${invalidCount} leads with invalid/missing LinkedIn URLs`);
    }

    // Save valid leads to PotentialLead entity
    for (const lead of validLeads.slice(0, 5)) {
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
        console.log('Lead save error:', e.message);
      }
    }

    // Sync valid leads to Google Sheets "לידים ביטחון 🎯" tab
    let syncedCount = 0;
    if (validLeads.length > 0) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
        syncedCount = await syncToSheet(authHeader, validLeads);
        console.log(`Synced ${syncedCount} leads to Google Sheets tab: ${DEFENSE_TAB}`);
      } catch (sheetErr) {
        console.error('Sheet sync error:', sheetErr.message);
      }
    }

    return Response.json({
      success: true,
      leads: validLeads,
      found: validLeads.length,
      filtered_invalid: invalidCount,
      synced_to_sheet: syncedCount,
      summary: `סקן LinkedIn הושלם: ${validLeads.length} לידים תקינים (${invalidCount} סוננו ללא URL) — ${syncedCount} סונכרנו לגוגל שיטס`,
    });
  } catch (error) {
    console.error('scanLinkedInLeads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});