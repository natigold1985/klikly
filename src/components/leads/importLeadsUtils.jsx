import { base44 } from '@/api/base44Client';

const PHONE_KEYS = ['phone', 'Phone', 'Phone Number', 'phone_number', 'טלפון', 'מספר טלפון', 'מספר נייד', 'נייד', 'mobile', 'Mobile', 'Contact', 'contact', 'sender', 'Sender', 'מספר'];
const NAME_KEYS = ['name', 'Name', 'full_name', 'Full Name', 'Contact Name', 'contact_name', 'שם מלא', 'שם', 'שם איש קשר', 'שם לקוח'];
const FIRST_NAME_KEYS = ['first_name', 'First Name', 'שם פרטי'];
const EMAIL_KEYS = ['email', 'Email', 'אימייל', 'מייל'];
const SOURCE_KEYS = ['source', 'Source', 'מקור'];
const TYPE_KEYS = ['shooting_type', 'סוג צילום', 'עניין', 'תחום'];
const NOTES_KEYS = ['notes', 'Notes', 'הערות', 'שם מלא והערות', 'message', 'Message', 'query', 'Query', 'תוכן', 'הודעה'];

function pick(row, keys) {
  const normalized = Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = value;
    return acc;
  }, {});
  const key = keys.find((item) => normalized[String(item).trim().toLowerCase()] !== undefined && String(normalized[String(item).trim().toLowerCase()]).trim() !== '');
  return key ? String(normalized[String(key).trim().toLowerCase()]).trim() : '';
}

function normalizePhone(value) {
  const raw = String(value || '').replace('@s.whatsapp.net', '').replace('@c.us', '').trim();
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return '';
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return digits.startsWith('+') ? raw : `+${digits}`;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvText(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line).map((value) => value.replace(/^"|"$/g, '').trim());
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });
}

function normalizeLead(row, defaultSource = 'CSV Import') {
  const phone = normalizePhone(pick(row, PHONE_KEYS));
  const fullName = pick(row, NAME_KEYS);
  const firstName = pick(row, FIRST_NAME_KEYS);
  const notes = pick(row, NOTES_KEYS);
  if (!phone) return null;

  return {
    name: fullName || firstName || phone,
    phone,
    email: pick(row, EMAIL_KEYS),
    source: defaultSource,
    shooting_type: pick(row, TYPE_KEYS),
    notes: notes || fullName || '',
    status: 'new',
    last_contact_date: new Date().toISOString(),
  };
}

export function normalizeRowsToLeads(rows, defaultSource = 'CSV Import') {
  return rows.map((row) => normalizeLead(row, defaultSource)).filter(Boolean);
}

export async function extractLeadsFromFile(file, defaultSource = 'CSV Import') {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');

  if (isCsv) {
    const text = await file.text();
    return normalizeRowsToLeads(parseCsvText(text), defaultSource);
  }

  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url,
    json_schema: {
      type: 'object',
      properties: {
        leads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              first_name: { type: 'string' },
              full_name: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              source: { type: 'string' },
              shooting_type: { type: 'string' },
              notes: { type: 'string' },
              'מספר נייד': { type: 'string' },
              'שם': { type: 'string' },
              'שם מלא': { type: 'string' },
            },
          },
        },
      },
    },
  });

  if (extracted.status !== 'success') {
    throw new Error(extracted.details || 'לא הצלחתי לקרוא את הקובץ');
  }

  const rows = Array.isArray(extracted.output?.leads) ? extracted.output.leads : [];
  return normalizeRowsToLeads(rows, defaultSource);
}

export async function upsertLeads(leads, options = {}) {
  const existingLeads = await base44.entities.Lead.list('-created_date', 1000);
  const newLeads = [];
  let updated = 0;

  for (const lead of leads) {
    const phone = String(lead.phone || '').replace(/[^0-9]/g, '');
    const email = String(lead.email || '').toLowerCase();
    const existing = existingLeads.find((item) => {
      const itemPhone = String(item.phone || '').replace(/[^0-9]/g, '');
      const itemEmail = String(item.email || '').toLowerCase();
      return (phone && itemPhone === phone) || (email && itemEmail === email);
    });

    if (existing) {
      await base44.entities.Lead.update(existing.id, {
        name: existing.name || lead.name,
        email: existing.email || lead.email,
        source: options.forceSource ? lead.source : (existing.source || lead.source),
        shooting_type: existing.shooting_type || lead.shooting_type,
        notes: [existing.notes, lead.notes].filter(Boolean).join('\n'),
        last_contact_date: new Date().toISOString(),
      });
      updated += 1;
    } else {
      newLeads.push(lead);
    }
  }

  if (newLeads.length > 0) {
    await base44.entities.Lead.bulkCreate(newLeads);
  }

  return { added: newLeads.length, updated };
}