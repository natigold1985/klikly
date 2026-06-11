import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const DEFENSE_TAB = 'לידים ביטחון 🎯';
const HEADERS = ['שם מלא', 'תפקיד', 'חברה', 'טלפון', 'מייל', 'קישור LinkedIn', 'סטטוס', 'תאריך'];

function isValidLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return /linkedin\.com\/in\/[a-z0-9\-_%]{3,}/.test(clean);
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
      prompt: `סרוק את LinkedIn וחפש אנשי קשר רלוונטיים לצילום אירועים מקצועיים בחברות ביטחון ובצבא בישראל.

הקהל היעד המדויק שלי הוא:

**בחברות תעשיית הביטחון** (רפאל, אלביט, IAI, ELTA, Soltam, NICE, Cyberspark וכד'):
- Head of Marketing / Marketing Manager / מנהל/ת שיווק
- HR Manager / Head of HR / מנהל/ת משאבי אנוש / Talent Acquisition
- Employer Branding Manager
- Events Manager / מנהל/ת אירועים
- Internal Communications / תקשורת פנים ארגונית
- People & Culture

**בצבא / יחידות צבאיות (IDF)**:
- משקית חינוך / קצינת חינוך (Education Officer)
- משקית תש"ן / קצינת תש"ן (תרבות, שכר, נופש - Welfare Officer)
- משקית חוויה / קצינת חוויה / ריכוז חוויות (Experience Officer)
- ממונה על אירועים ביחידה
- קצין/ת רווחה (Welfare)

**למה אלו?** אלו האנשים שמזמינים צלמים לאירועי חברה, ימי גיבוש, טקסים, חגיגות, דיוקנאות צוות וצילומי תדמית. לא מנכ"לים — אלו אנשי השטח שמחליטים.

חשוב מאוד:
- החזר רק אנשים עם פרופיל LinkedIn אמיתי ו-URL תקין: https://www.linkedin.com/in/PROFILE-SLUG
- ה-URL חייב להכיל linkedin.com/in/ ואחריו שם פרופיל אמיתי
- לא /search, לא /company
- העדף נשים בתפקידי HR/חינוך/חוויה — כי רוב המשקיות הן נשים
- התמקד בישראל

החזר JSON:
{
  "leads": [
    {
      "name": "שם מלא",
      "title": "כותרת משרה",
      "company": "שם החברה",
      "email": "אימייל אם זמין",
      "phone": "טלפון אם זמין",
      "profileUrl": "https://www.linkedin.com/in/profile-slug",
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
    });

    const allLeads = llmResult?.leads || [];
    const validLeads = allLeads.filter(lead => isValidLinkedInUrl(lead.profileUrl));
    const invalidCount = allLeads.length - validLeads.length;

    if (invalidCount > 0) {
      console.log(`Filtered out ${invalidCount} leads with invalid/missing LinkedIn URLs`);
    }

    for (const lead of validLeads.slice(0, 5)) {
      try {
        await base44.asServiceRole.entities.PotentialLead.create({
          title: `${lead.name} - ${lead.title}`,
          source_url: lead.profileUrl,
          platform: 'linkedin',
          snippet: `${lead.company} - ${lead.title}`,
          keywords_matched: 'שיווק, HR, משקיות, חינוך, חוויה',
          relevance_score: lead.relevanceScore || 8,
          contact_info: `${lead.email || 'לא זמין'} / ${lead.phone || 'לא זמין'}`,
        });
      } catch (e) {
        console.log('Lead save error:', e.message);
      }
    }

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