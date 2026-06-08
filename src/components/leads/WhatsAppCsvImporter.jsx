import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, CheckCircle2, FileSpreadsheet, FileSpreadsheet as SheetsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cleanLeadNotes, inferLeadSource } from '@/utils/leadDisplay';

const SOURCE_OPTIONS = ['Photography Course', 'KLIKLY', 'WhatsApp JONI'];

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

function cleanValue(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().replace(/^"|"$/g, '');
}

function mapRows(rows) {
  const leads = [];
  let skipped = 0;

  rows.forEach((row) => {
    const phoneNumber = cleanValue(row['מספר נייד']);
    const firstName = cleanValue(row['שם']);
    const fullNameNotes = cleanValue(row['שם מלא']);

    if (!phoneNumber) {
      if (firstName || fullNameNotes) skipped += 1;
      return;
    }

    leads.push({
      phone_number: phoneNumber,
      first_name: firstName,
      full_name_notes: fullNameNotes,
      status: 'New Lead',
    });
  });

  return { leads, skipped };
}

function parseLeadsFromCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { leads: [], skipped: 0, totalRows: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0].replace(/^\uFEFF/, ''), delimiter).map(cleanValue);
  const missingHeaders = ['מספר נייד', 'שם', 'שם מלא'].filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`חסרות עמודות חובה: ${missingHeaders.join(', ')}`);
  }

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter).map(cleanValue);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });

  const mapped = mapRows(rows);
  return { ...mapped, totalRows: rows.length };
}

export default function WhatsAppCsvImporter({ onComplete }) {
  const inputRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState('KLIKLY');
  const [preview, setPreview] = useState(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsParsing(true);
    setResult(null);
    setPreview(null);

    try {
      const lowerName = file.name.toLowerCase();
      let parsed;

      if (lowerName.endsWith('.xlsx')) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const response = await base44.functions.invoke('parseLeadImportFile', {
          file_url,
          file_name: file.name,
        });
        parsed = {
          leads: response.data?.leads || [],
          skipped: response.data?.skipped || 0,
          totalRows: response.data?.total_rows || 0,
        };
      } else {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buffer);
        parsed = parseLeadsFromCsv(text);
      }

      if (parsed.leads.length === 0) {
        setResult({ success: false, message: 'לא נמצאו בקובץ לידים עם מספר נייד.' });
        toast.error('לא נמצאו לידים תקינים בקובץ');
        return;
      }

      setPreview({ fileName: file.name, ...parsed });
      toast.success(`${parsed.leads.length} שורות מוכנות לתצוגה מקדימה`);
    } catch (error) {
      setResult({ success: false, message: error.message });
      toast.error('שגיאה בקריאת הקובץ');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview?.leads?.length) return;

    setIsImporting(true);
    setResult(null);

    try {
      const now = new Date().toISOString();
      const leads = preview.leads.map((lead) => {
        const notes = cleanLeadNotes(lead.full_name_notes);
        const sourceFromNotes = inferLeadSource({ source, notes });
        const isCourse =
          sourceFromNotes === 'קורס צילום' ||
          /קורס|7 ימים|שבעה ימים|להבין הכל/i.test(notes) ||
          /קורס|7 ימים|שבעה ימים|להבין הכל/i.test(lead.full_name_notes || '');
        return {
          name: lead.first_name || notes || lead.phone_number,
          phone: lead.phone_number,
          notes,
          source: 'WhatsApp',
          shooting_type: isCourse ? 'קורס צילום' : '',
          lead_type: isCourse ? 'מתעניין בקורס' : 'שירותי צילום',
          status: 'new',
          last_contact_date: now,
        };
      });

      await base44.entities.Lead.bulkCreate(leads);

      // Sync to Google Sheets — WhatsApp tab
      let sheetsMsg = '';
      try {
        const sheetsRes = await base44.functions.invoke('syncJoniLeadsToSheets', { leads });
        const appended = sheetsRes.data?.appended ?? 0;
        const skipped = sheetsRes.data?.skipped ?? 0;
        sheetsMsg = ` | ${appended} נוספו לגוגל שיטס${skipped > 0 ? ` (${skipped} כפולים)` : ''}`;
      } catch (e) {
        console.warn('Sheets sync failed:', e.message);
        sheetsMsg = ' | שגיאה בסנכרון לגוגל שיטס';
      }

      setResult({ success: true, message: `${leads.length} לידים יובאו בהצלחה${sheetsMsg}` });
      toast.success(`${leads.length} לידים יובאו${sheetsMsg}`);
      setPreview(null);
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
        accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-900">ייבוא CSV / Excel לפי כותרות בעברית</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">נדרש: מספר נייד, שם, שם מלא. הייבוא נכנס למסך ניהול הלידים הראשי.</p>

        <div className="mb-4 text-right">
          <label className="block text-xs font-bold text-slate-700 mb-1">מקור לכל הקובץ</label>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
          >
            {SOURCE_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={isParsing || isImporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-black shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          בחר קובץ CSV / Excel
        </button>
      </div>

      {preview && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">תצוגה מקדימה</p>
              <p className="text-xs text-slate-500">{preview.fileName} · {preview.leads.length} לייבוא · {preview.skipped} דולגו</p>
            </div>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              ייבא עכשיו
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Phone Number</th>
                  <th className="p-2">First Name</th>
                  <th className="p-2">Full Name and Notes</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.leads.slice(0, 5).map((lead, index) => (
                  <tr key={`${lead.phone_number}-${index}`} className="border-t border-slate-100">
                    <td className="p-2 font-mono">{lead.phone_number}</td>
                    <td className="p-2">{lead.first_name || '—'}</td>
                    <td className="p-2 max-w-40 truncate">{lead.full_name_notes || '—'}</td>
                    <td className="p-2">{source}</td>
                    <td className="p-2">New Lead</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.success && <CheckCircle2 className="w-4 h-4" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}