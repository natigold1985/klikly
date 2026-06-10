import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function normalizePhone(raw = '') {
  const s = String(raw).replace(/[^0-9+]/g, '');
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.startsWith('972') && digits.length >= 11) return '0' + digits.slice(3);
  if (digits.startsWith('0')) return digits;
  if (/^[5][0-9]{8}$/.test(digits)) return '0' + digits;
  return digits;
}

function extractShootingType(name = '') {
  const lower = name.toLowerCase();
  if (/תדמית|brand|portrait/.test(lower)) return 'צילומי תדמית';
  if (/אירוע|event|חתונה|בר מצווה/.test(lower)) return 'צילום אירועים';
  if (/סושיאל|social/.test(lower)) return 'צילומי סושיאל';
  if (/מוצר|product/.test(lower)) return 'צילום מוצרים';
  if (/וידאו|video|סרטון/.test(lower)) return 'סרטון תדמית';
  return '';
}

// Parse CSV with BOM support
function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"+|"+$/g, '').toLowerCase());
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'טלפון');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'שם');
  const labelIdx = headers.findIndex(h => h === 'labels' || h === 'תוויות');

  if (phoneIdx === -1) return null; // missing required column

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"+|"+$/g, ''));
    const rawPhone = cols[phoneIdx] || '';
    const rawName = nameIdx !== -1 ? cols[nameIdx] || '' : '';
    const label = labelIdx !== -1 ? cols[labelIdx] || '' : '';
    const phone = normalizePhone(rawPhone);
    if (!phone || phone.length < 9) continue;
    rows.push({ phone, name: rawName, label });
  }
  return rows;
}

export default function WhatsAppContactsImporter({ onComplete }) {
  const [rows, setRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFile = (file) => {
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCsv(text);
      if (parsed === null) {
        setError('לא נמצאה עמודת "phone" בקובץ. ודא שזהו קובץ הייצוא מהתוסף.');
        return;
      }
      if (parsed.length === 0) {
        setError('לא נמצאו שורות עם מספר טלפון תקין.');
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      // Load existing leads to deduplicate
      const existing = await base44.entities.Lead.list('-created_date', 2000);
      const phoneMap = {};
      for (const l of existing) {
        const np = l.phone?.replace(/[^0-9]/g, '');
        if (np) phoneMap[np] = l;
      }

      const toCreate = [];
      let skipped = 0;

      for (const row of rows) {
        const np = row.phone.replace(/[^0-9]/g, '');
        if (phoneMap[np]) { skipped++; continue; }

        const shootingType = extractShootingType(row.name);
        toCreate.push({
          phone: row.phone,
          name: row.name || row.phone,
          source: 'WhatsApp',
          shooting_type: shootingType || undefined,
          notes: row.label ? `תווית: ${row.label}` : undefined,
          status: 'ליד חדש',
          pipeline: 'events_b2b',
          pipeline_stage: 'lead_found',
          last_contact_date: new Date().toISOString(),
        });
        phoneMap[np] = true; // prevent intra-batch duplicates
      }

      if (toCreate.length > 0) {
        await base44.entities.Lead.bulkCreate(toCreate);
      }

      setResult({ added: toCreate.length, skipped });
      toast.success(`יובאו ${toCreate.length} לידים חדשים${skipped > 0 ? `, ${skipped} כפילויות דולגו` : ''}`);
      setRows(null);
      onComplete?.();
    } catch (e) {
      setError('שגיאה בייבוא: ' + e.message);
      toast.error('שגיאה בייבוא');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-slate-600">
        ייצא קובץ CSV מהתוסף <strong>WhatsApp Lead Manager</strong> ועלה אותו כאן.
        <br />
        הקובץ צריך לכלול עמודות: <code className="bg-slate-100 px-1 rounded text-xs">phone, name, labels</code>
      </p>

      {/* Drop zone */}
      {!rows && (
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">לחץ לבחירת קובץ או גרור לכאן</p>
          <p className="text-xs text-slate-400 mt-1">קבצי CSV בלבד</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {rows && !result && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-800">
            נמצאו <strong>{rows.length}</strong> אנשי קשר מוכנים לייבוא
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50 text-xs">
            {rows.slice(0, 20).map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="text-slate-400 w-5 text-center">{i + 1}</span>
                <span className="font-medium text-slate-800 flex-1 truncate">{r.name || '—'}</span>
                <span className="text-slate-500 dir-ltr">{r.phone}</span>
                {r.label && <span className="bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded-full">{r.label}</span>}
              </div>
            ))}
            {rows.length > 20 && (
              <div className="px-3 py-2 text-center text-slate-400">ועוד {rows.length - 20} נוספים...</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={importing} className="flex-1 gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'מייבא...' : `ייבא ${rows.length} לידים`}
            </Button>
            <Button variant="outline" onClick={() => { setRows(null); setError(''); }}>
              בטל
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          יובאו <strong>{result.added}</strong> לידים חדשים
          {result.skipped > 0 && `, ${result.skipped} כפילויות דולגו`}
        </div>
      )}
    </div>
  );
}