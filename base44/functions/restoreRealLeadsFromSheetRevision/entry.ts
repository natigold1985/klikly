import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const DEFAULT_REVISION_ID = '182';

const HEADER_KEYS = {
  name: ['name', 'שם', 'שם מלא', 'fullname', 'lead'],
  phone: ['phone', 'טלפון', 'tel', 'mobile', 'נייד'],
  email: ['email', 'מייל', 'דוא"ל', 'דואל', 'mail', 'e-mail'],
  source: ['source', 'מקור', 'platform', 'פלטפורמה', 'ערוץ'],
  type: ['type', 'סוג', 'סוג שירות', 'service', 'shoot type'],
  address: ['address', 'כתובת', 'city', 'עיר'],
  notes: ['note', 'הערה', 'הערות', 'message', 'הודעה', 'תוכן הודעה', 'תיאור'],
  link: ['link', 'קישור', 'url', 'source url', 'source_url', 'קישור מקור', 'קישור ליד'],
  status: ['סטטוס', 'status'],
};

function cell(value) {
  return String(value || '').trim();
}

function findColumnIndex(headers, keys) {
  for (let i = 0; i < headers.length; i++) {
    const header = cell(headers[i]).toLowerCase();
    if (header && keys.some((key) => header.includes(key.toLowerCase()))) return i;
  }
  return -1;
}

function normalizePhone(value) {
  return cell(value).replace(/[^0-9]/g, '');
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  const local = digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
  if (!local || /^(\d)\1+$/.test(local)) return false;
  if (/123456|234567|345678|456789|987654|876543|765432|654321/.test(local)) return false;
  if (/(\d)\1{2,}/.test(local)) return false;
  return /^05\d{8}$/.test(local) || /^0[23489]\d{7}$/.test(local);
}

function isValidEmail(value) {
  return !!(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell(value)));
}

function isFullName(value) {
  const clean = cell(value);
  const low = clean.toLowerCase();
  const bad = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא', 'שם'];
  if (!clean || clean.length < 3 || bad.includes(low)) return false;
  if (/^https?:\/\//i.test(clean) || clean.includes('@')) return false;
  if (clean.replace(/[^0-9]/g, '').length > 0) return false;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (/מנהל|מנהלת|אחראי|אחראית|marcom|marketing|communications|manager|תפקיד|חברה|מחלקה|עמוד|קורס/i.test(clean)) return false;
  return /[א-תa-zA-Z]/.test(clean);
}

function extractUrl(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const match = text.match(/https?:\/\/[^\s|,)>"']+/i);
  return match ? match[0].replace(/[)\]"'<>.,]+$/g, '') : '';
}

function detectSource(sheetName, source, link, notes) {
  const text = [sheetName, source, link, notes].join(' ').toLowerCase();
  if (text.includes('claude code')) return 'Claude Code';
  if (text.includes('ביטחון') || text.includes('משרד הביטחון') || text.includes('defense') || text.includes('mod.gov')) return 'משרד הביטחון';
  if (text.includes('linkedin')) return 'LinkedIn';
  if (text.includes('facebook') || text.includes('fb.com')) return 'Facebook';
  if (text.includes('instagram') || text.includes('ig.me') || text.includes('אינסטגרם')) return 'Instagram';
  if (text.includes('whatsapp') || text.includes('וואטסאפ')) return 'WhatsApp';
  return source || sheetName || 'Google Sheets';
}

function isRelevantSheet(sheetName) {
  const text = sheetName.toLowerCase();
  if (text.includes('מסוננים') || text.includes('קורס')) return false;
  return text.includes('claude code') || text.includes('ביטחון') || text.includes('לידים') || text.includes('כל הלידים');
}

function shouldRestore({ sheetName, name, phone, email, source, type, notes, link }) {
  const allText = [sheetName, name, source, type, notes, link].join(' ').toLowerCase();
  if (!isRelevantSheet(sheetName)) return false;
  if (!isFullName(name)) return false;
  if (!isValidPhone(phone) && !isValidEmail(email)) return false;
  if (/photography-course|קורס צילום|קורסי צילום|שבעה ימים להבין הכל|עמוד נחיתה/.test(allText)) return false;
  if (/מנהל\s*שיווק|מנהלת\s*שיווק|marketing\s*manager|marcom/.test(allText)) return false;
  return true;
}

function classifyPipeline(source = '', notes = '', type = '') {
  const text = [source, notes, type].join(' ').toLowerCase();
  if (/משרד הביטחון|ביטחון|mod\.gov|defense|רפאל|אלביט|תעשייה אווירית|iai|rafael|elbit/.test(text)) {
    return { pipeline: 'defense_industry', pipeline_stage: 'lead_found' };
  }
  return { pipeline: 'events_b2b', pipeline_stage: 'quote_sent' };
}

function parseRow(sheetName, row, headers) {
  let idx = {
    name: findColumnIndex(headers, HEADER_KEYS.name),
    phone: findColumnIndex(headers, HEADER_KEYS.phone),
    email: findColumnIndex(headers, HEADER_KEYS.email),
    source: findColumnIndex(headers, HEADER_KEYS.source),
    type: findColumnIndex(headers, HEADER_KEYS.type),
    address: findColumnIndex(headers, HEADER_KEYS.address),
    notes: findColumnIndex(headers, HEADER_KEYS.notes),
    link: findColumnIndex(headers, HEADER_KEYS.link),
    status: findColumnIndex(headers, HEADER_KEYS.status),
  };

  if (sheetName.toLowerCase().includes('claude code')) {
    idx = { status: 0, name: 1, phone: 2, email: 3, source: 4, type: 5, address: -1, notes: 7, link: 8 };
  }

  const get = (index) => index !== -1 ? cell(row[index]) : '';
  const name = get(idx.name);
  const phone = get(idx.phone);
  const email = get(idx.email);
  const sourceCol = get(idx.source);
  const type = get(idx.type);
  const address = get(idx.address);
  const notesCol = get(idx.notes);
  const link = get(idx.link);
  const sourceUrl = extractUrl(link, notesCol, sourceCol);
  const source = detectSource(sheetName, sourceCol, link, notesCol);
  const notes = [notesCol, link ? `קישור: ${link}` : ''].filter(Boolean).join(' | ');
  const pipeline = classifyPipeline(source, notes, type);

  return { sheetName, name, phone, email, source, type, address, notes, link, sourceUrl, pipeline, rawRow: row };
}

async function bulkCreate(base44, entityName, records) {
  let created = 0;
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    if (chunk.length) {
      await base44.asServiceRole.entities[entityName].bulkCreate(chunk);
      created += chunk.length;
    }
  }
  return created;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const revisionId = body.revisionId || DEFAULT_REVISION_ID;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    const exportResp = await fetch(`https://docs.google.com/spreadsheets/export?id=${SPREADSHEET_ID}&revision=${revisionId}&exportFormat=xlsx`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!exportResp.ok) {
      const details = await exportResp.text();
      return Response.json({ error: 'Failed to export revision', details }, { status: exportResp.status });
    }

    const workbook = XLSX.read(await exportResp.arrayBuffer(), { type: 'array' });
    const selectedRowsBySheet = {};
    const leadRecords = [];
    const potentialRecords = [];
    const seen = new Set();
    const perSheet = {};

    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
      if (rows.length < 2) continue;
      const headers = rows[0];
      let selected = 0;
      let skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((value) => !cell(value))) continue;
        const parsed = parseRow(sheetName, row, headers);
        if (!shouldRestore(parsed)) {
          skipped++;
          continue;
        }

        const key = normalizePhone(parsed.phone) || parsed.email.toLowerCase() || `${parsed.name.toLowerCase()}|${parsed.source.toLowerCase()}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        selected++;

        if (!selectedRowsBySheet[sheetName]) selectedRowsBySheet[sheetName] = [];
        selectedRowsBySheet[sheetName].push(row);

        leadRecords.push({
          name: parsed.name,
          phone: parsed.phone || '',
          email: parsed.email || undefined,
          source: parsed.source,
          source_post_url: parsed.sourceUrl || undefined,
          shooting_type: parsed.type || undefined,
          address: parsed.address || undefined,
          notes: parsed.notes || undefined,
          status: 'ליד חדש',
          pipeline: parsed.pipeline.pipeline,
          pipeline_stage: parsed.pipeline.pipeline_stage,
          last_contact_date: new Date().toISOString(),
          is_filtered: false,
        });

        if (sheetName.toLowerCase().includes('claude code')) {
          potentialRecords.push({
            title: `${parsed.name} — ${parsed.type || parsed.source}`.slice(0, 200),
            platform: 'other',
            snippet: [parsed.type, parsed.notes].filter(Boolean).join(' | ').slice(0, 500),
            source_url: parsed.sourceUrl || '',
            keywords_matched: parsed.source,
            relevance_score: isValidPhone(parsed.phone) ? 9 : 7,
            contact_info: [parsed.phone, parsed.email].filter(Boolean).join(' / '),
            notes: 'שוחזר מ-Claude Code',
            status: 'new',
          });
        }
      }
      perSheet[sheetName] = { selected, skipped };
    }

    const leadsCreated = body.dryRun ? 0 : await bulkCreate(base44, 'Lead', leadRecords);
    const potentialCreated = body.dryRun ? 0 : await bulkCreate(base44, 'PotentialLead', potentialRecords);

    let sheetTabsUpdated = 0;
    if (!body.dryRun) {
      const { accessToken: sheetsToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
      const valueRanges = Object.entries(selectedRowsBySheet).map(([sheetName, rows]) => ({
        range: `'${sheetName.replace(/'/g, "''")}'!A2`,
        values: rows,
      }));
      if (valueRanges.length > 0) {
        const updateResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueRanges }),
        });
        if (!updateResp.ok) {
          const details = await updateResp.text();
          return Response.json({ error: 'Leads restored but failed to update sheet', details, leadsCreated, potentialCreated }, { status: updateResp.status });
        }
        sheetTabsUpdated = valueRanges.length;
      }
    }

    return Response.json({
      success: true,
      revisionId,
      dryRun: body.dryRun === true,
      selected: leadRecords.length,
      leadsCreated,
      potentialCreated,
      sheetTabsUpdated,
      perSheet,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});