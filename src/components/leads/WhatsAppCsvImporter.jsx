import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const SOURCE = 'WhatsApp / Photography';

const NAME_HEADERS = [
  'name', 'full name', 'contact name', 'display name', 'first name',
  'שם', 'שם מלא', 'שם איש קשר', 'שם לקוח', 'שם פרטי'
];

const PHONE_HEADERS = [
  'phone', 'phone number', 'mobile', 'contact', 'number', 'sender',
  'טלפון', 'מספר טלפון', 'מספר נייד', 'נייד', 'מספר'
];

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
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
}

function detectDelimiter(firstLine) {
  const delimiters = [',', ';', '\t'];
  return delimiters.reduce((best, delimiter) => {
    const count = parseCsvLine(firstLine, delimiter).length;
    return count > best.count ? { delimiter, count } : best;
  }, { delimiter: ',', count: 0 }).delimiter;
}

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function normalizePhone(value) {
  const raw = String(value || '').replace('@s.whatsapp.net', '').replace('@c.us', '').trim();
  const digits = raw.replace(/[^0-9]/g, '');

  if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return '';
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function findColumnIndex(headers, wantedHeaders) {
  return headers.findIndex((header) => wantedHeaders.some((wanted) => header.includes(wanted)));
}

function parseLeadsFromCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  let nameIndex = findColumnIndex(headers, NAME_HEADERS);
  let phoneIndex = findColumnIndex(headers, PHONE_HEADERS);

  if (phoneIndex === -1) {
    const sampleRows = lines.slice(1, 8).map((line) => parseCsvLine(line, delimiter));
    phoneIndex = headers.findIndex((_, index) => sampleRows.some((row) => normalizePhone(row[index])));
  }

  if (nameIndex === -1) {
    nameIndex = headers.findIndex((_, index) => index !== phoneIndex);
  }

  if (phoneIndex === -1) return [];

  const uniquePhones = new Set();

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const phone = normalizePhone(values[phoneIndex]);
    const name = String(values[nameIndex] || '').trim() || phone;

    if (!phone || uniquePhones.has(phone.replace(/[^0-9]/g, ''))) return null;
    uniquePhones.add(phone.replace(/[^0-9]/g, ''));

    return {
      name,
      phone,
      source: SOURCE,
      status: 'new',
      last_contact_date: new Date().toISOString(),
    };
  }).filter(Boolean);
}

export default function WhatsAppCsvImporter({ onComplete }) {
  const inputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const leads = parseLeadsFromCsv(text);

      if (leads.length === 0) {
        setResult({ success: false, message: 'לא נמצאו בקובץ שמות ומספרי טלפון תקינים.' });
        toast.error('לא נמצאו לידים תקינים בקובץ');
        return;
      }

      await base44.entities.Lead.bulkCreate(leads);
      setResult({ success: true, message: `${leads.length} לידים יובאו בהצלחה` });
      toast.success(`${leads.length} לידים יובאו בהצלחה`);
      onComplete?.(leads.length);
    } catch (error) {
      setResult({ success: false, message: error.message });
      toast.error('שגיאה בייבוא הקובץ');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-900">ייבוא CSV מ-WhatsApp / JONI</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">המערכת תזהה אוטומטית עמודת שם ועמודת טלפון ותשמור ללידים.</p>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={isImporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-black shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          בחר קובץ CSV
        </button>
      </div>

      {result && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.success && <CheckCircle2 className="w-4 h-4" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}