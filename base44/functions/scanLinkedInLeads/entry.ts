import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const DEFENSE_TAB = 'לידים ביטחון 🎯';
const HEADERS = ['שם מלא', 'תפקיד', 'חברה', 'טלפון', 'מייל', 'קישור LinkedIn', 'סטטוס', 'תאריך'];

function isValidLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return /linkedin\.com\/in\/[a-z0-9\-_%]{3,}/.test(clean);
}

// Generate a focused LinkedIn search URL — first name + last name + company
function buildLinkedInSearchUrl(name, company) {
  // Use only name for keywords so the person appears as first result
  const q = name || '';
  const companyParam = company ? `&company=${encodeURIComponent(company)}` : '';
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}${companyParam}`;
}

async function syncToSheet(authHeader, leads) {
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

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt: `חפש באינטרנט אנשים אמיתיים בעלי פרופיל LinkedIn פעיל בתחום הביטחון בישראל.

🎯 הקהל היעד — תפקידי שיווק, HR ואירועים בלבד:

**1. תעשיות ביטחון** — רפאל, אלביט, IAI, ELTA, Soltam, NICE Systems, Cyberspark, Orbit, Tadiran, Aeronautics, Silicom, Radiflow, Epsilot Electric Fuel, SCD, Opgal, Camero, BIRD Aerosystems:
- VP Marketing / Head of Marketing / Marketing Manager / MarCom Manager
- Events Manager / Employer Branding / Internal Communications
- HR Business Partner / People & Culture / Talent Acquisition

**2. צה"ל — יחידות / מחנות**:
- קצינת חינוך / משקית חינוך / קצינת חוויה / משקית תש"ן / קצינת רווחה

**3. משרד הביטחון / גופים ביטחוניים**:
- תקשורת / שיווק / HR בלבד

🚫 לא לכלול: CEO, מהנדסים, R&D, מפקדים, לוחמים, מכירות טכניות

✅ חובה — כלל ברזל:
- חפש כל אדם ב-Google עם המחרוזת: site:linkedin.com/in "שם האדם" "שם החברה"
- ה-URL חייב להיות URL שמצאת בפועל בחיפוש אינטרנט — לא URL שהמצאת!
- אם לא מצאת URL ישיר — השאר את profileUrl ריק ("") ואל תמציא
- אסור להמציא slugs! רק URLs שאתה בטוח שקיימים
- התמקד בישראל בלבד

החזר JSON עם לפחות 10 אנשים:
{
  "leads": [
    {
      "name": "שם מלא",
      "title": "כותרת משרה",
      "company": "שם החברה/יחידה",
      "email": "אימייל אם זמין (או רק '')",
      "phone": "טלפון אם זמין (או רק '')",
      "profileUrl": "https://www.linkedin.com/in/SLUG-שמצאת-בחיפוש או '' אם לא מצאת",
      "relevanceScore": 1-10
    }
  ],
  "found": number,
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
      model: 'gemini_3_1_pro',
    });

    const allLeads = llmResult?.leads || [];

    // Use real /in/ URL if LLM provided one, otherwise build a search URL
    const processedLeads = allLeads.map(lead => {
      const hasValidUrl = isValidLinkedInUrl(lead.profileUrl);
      const finalUrl = hasValidUrl
        ? lead.profileUrl
        : buildLinkedInSearchUrl(lead.name, lead.company);
      return { ...lead, profileUrl: finalUrl, urlIsSearch: !hasValidUrl };
    });

    const invalidCount = allLeads.filter(l => !isValidLinkedInUrl(l.profileUrl)).length;
    if (invalidCount > 0) {
      console.log(`${invalidCount} leads had no valid URL — replaced with LinkedIn search links`);
    }

    for (const lead of processedLeads.slice(0, 10)) {
      try {
        await base44.asServiceRole.entities.PotentialLead.create({
          title: `${lead.name} - ${lead.title}`,
          source_url: lead.profileUrl,
          platform: 'linkedin',
          snippet: `${lead.company} - ${lead.title}`,
          keywords_matched: 'שיווק, HR, מרקטינג, משקיות, חינוך, חוויה, תש"ן, ביטחון, תעשיות ביטחון, צה"ל, שב"כ',
          relevance_score: lead.relevanceScore || 8,
          contact_info: `${lead.email || 'לא זמין'} / ${lead.phone || 'לא זמין'}`,
          notes: lead.urlIsSearch ? `🔍 חיפוש LinkedIn: ${lead.profileUrl}` : null,
        });
      } catch (e) {
        console.log('Lead save error:', e.message);
      }
    }

    const validLeads = processedLeads;

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
      summary: `סקן LinkedIn הושלם: ${validLeads.length} לידים (${invalidCount} סוננו) — ${syncedCount} סונכרנו לשיטס`,
    });
  } catch (error) {
    console.error('scanLinkedInLeads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});