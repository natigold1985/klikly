import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const REQUIRED_HEADERS = ['מספר נייד', 'שם', 'שם מלא'];

function cleanValue(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().replace(/^"|"$/g, '');
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(cleanValue(current));
      current = '';
    } else {
      current += char;
    }
  }

  values.push(cleanValue(current));
  return values;
}

function detectDelimiter(firstLine) {
  return [',', ';', '\t'].reduce((best, delimiter) => {
    const count = parseCsvLine(firstLine, delimiter).length;
    return count > best.count ? { delimiter, count } : best;
  }, { delimiter: ',', count: 0 }).delimiter;
}

function mapRows(rows) {
  const leads = [];
  let skipped = 0;

  for (const row of rows) {
    const phoneNumber = cleanValue(row['מספר נייד']);
    const firstName = cleanValue(row['שם']);
    const fullNameNotes = cleanValue(row['שם מלא']);

    if (!phoneNumber) {
      if (firstName || fullNameNotes) skipped += 1;
      continue;
    }

    leads.push({
      phone_number: phoneNumber,
      first_name: firstName,
      full_name_notes: fullNameNotes,
      status: 'New Lead',
    });
  }

  return { leads, skipped };
}

function parseCsv(buffer) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });

  return { headers, rows };
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  const headers = rows[0] ? Object.keys(rows[0]).map(cleanValue) : [];
  return { headers, rows };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, file_name } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url required' }, { status: 400 });
    }

    const response = await fetch(file_url);
    if (!response.ok) {
      return Response.json({ error: 'Could not read uploaded file' }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();
    const lowerName = String(file_name || file_url).toLowerCase();
    const parsed = lowerName.endsWith('.xlsx') ? parseXlsx(buffer) : parseCsv(buffer);
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !parsed.headers.includes(header));

    if (missingHeaders.length > 0) {
      return Response.json({
        error: `חסרות עמודות חובה: ${missingHeaders.join(', ')}`,
        missing_headers: missingHeaders,
      }, { status: 400 });
    }

    const mapped = mapRows(parsed.rows);

    return Response.json({
      success: true,
      headers: parsed.headers,
      leads: mapped.leads,
      skipped: mapped.skipped,
      total_rows: parsed.rows.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});