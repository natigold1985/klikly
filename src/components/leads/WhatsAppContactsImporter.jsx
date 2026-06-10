import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Users, Phone, Tag, ArrowRight, Sparkles, X } from 'lucide-react';
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

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"+|"+$/g, '').toLowerCase());
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'טלפון');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'שם');
  const labelIdx = headers.findIndex(h => h === 'labels' || h === 'תוויות');

  if (phoneIdx === -1) return null;

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

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Deterministic pastel color from string
function avatarColor(str = '') {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function WhatsAppContactsImporter({ onComplete }) {
  const [rows, setRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCsv(e.target.result);
      if (parsed === null) {
        setError('לא נמצאה עמודת "phone" — ודא שזהו קובץ הייצוא מהתוסף');
        return;
      }
      if (parsed.length === 0) {
        setError('לא נמצאו שורות עם מספר טלפון תקין');
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!rows?.length) return;
    setImporting(true);
    setResult(null);
    try {
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
        toCreate.push({
          phone: row.phone,
          name: row.name || row.phone,
          source: 'WhatsApp',
          shooting_type: extractShootingType(row.name) || undefined,
          notes: row.label ? `תווית: ${row.label}` : undefined,
          status: 'ליד חדש',
          pipeline: 'events_b2b',
          pipeline_stage: 'lead_found',
          last_contact_date: new Date().toISOString(),
        });
        phoneMap[np] = true;
      }

      if (toCreate.length > 0) await base44.entities.Lead.bulkCreate(toCreate);

      setResult({ added: toCreate.length, skipped });
      toast.success(`יובאו ${toCreate.length} לידים חדשים`);
      setRows(null);
      onComplete?.();
    } catch (e) {
      setError('שגיאה בייבוא: ' + e.message);
      toast.error('שגיאה בייבוא');
    } finally {
      setImporting(false);
    }
  };

  // ── Success state
  if (result) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{result.added} לידים יובאו</p>
          {result.skipped > 0 && (
            <p className="text-sm text-slate-500 mt-1">{result.skipped} כפילויות דולגו אוטומטית</p>
          )}
        </div>
        <Button
          variant="outline"
          className="gap-2 mt-2"
          onClick={() => { setResult(null); setRows(null); }}
        >
          <Sparkles className="w-4 h-4" />
          ייבא קובץ נוסף
        </Button>
      </div>
    );
  }

  // ── Preview state
  if (rows) {
    const labels = [...new Set(rows.map(r => r.label).filter(Boolean))];
    return (
      <div className="space-y-4 mt-1">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'אנשי קשר', value: rows.length, iconColor: 'text-violet-600', bg: 'bg-violet-50' },
            { icon: Phone, label: 'מספרים תקינים', value: rows.filter(r => r.phone.length >= 10).length, iconColor: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Tag, label: 'תוויות', value: labels.length, iconColor: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ icon: StatIcon, label, value, iconColor, bg }) => (
            <div key={label} className={`rounded-2xl p-3 text-center ${bg}`}>
              <StatIcon className={`w-5 h-5 mx-auto mb-1 ${iconColor}`} />
              <p className={`text-xl font-bold ${iconColor}`}>{value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Contact list */}
        <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">תצוגה מקדימה</p>
            <button
              onClick={() => { setRows(null); setError(''); }}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
              aria-label="בטל"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {rows.slice(0, 30).map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(r.name)}`}>
                  {getInitials(r.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.name || '—'}</p>
                  <p className="text-xs text-slate-400 font-mono">{r.phone}</p>
                </div>
                {r.label && (
                  <span className="flex-shrink-0 text-[10px] bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/20 px-2 py-0.5 rounded-full font-medium">
                    {r.label}
                  </span>
                )}
              </div>
            ))}
            {rows.length > 30 && (
              <div className="px-4 py-3 text-center text-xs text-slate-400">
                ועוד <strong>{rows.length - 30}</strong> אנשי קשר...
              </div>
            )}
          </div>
        </div>

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#22c55e] text-white font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {importing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> מייבא לידים...</>
          ) : (
            <><Users className="w-4 h-4" /> ייבא {rows.length} לידים לאפליקציה <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    );
  }

  // ── Drop zone state
  return (
    <div className="space-y-5 mt-1">
      {/* Instructions */}
      <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 rounded-2xl p-4 border border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-lg">📱</span>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">כיצד לייצא מהתוסף?</p>
          <ol className="space-y-0.5 text-slate-500 list-none">
            <li>1. פתח את תוסף <strong className="text-slate-700">WhatsApp Lead Manager</strong></li>
            <li>2. בחר לידים → לחץ <strong className="text-slate-700">Export CSV</strong></li>
            <li>3. העלה את הקובץ שהורד כאן</li>
          </ol>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-[#25D366] bg-[#25D366]/5 scale-[1.01]'
            : 'border-slate-200 hover:border-[#25D366]/60 hover:bg-[#25D366]/5'
        }`}
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        role="button"
        aria-label="העלה קובץ CSV"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
      >
        {/* Animated WhatsApp icon */}
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-transform duration-200 ${isDragging ? 'scale-110 bg-[#25D366]' : 'bg-[#25D366]/10'}`}>
          <svg viewBox="0 0 24 24" className={`w-9 h-9 transition-colors duration-200 ${isDragging ? 'text-white' : 'text-[#25D366]'}`} fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>

        <p className="text-base font-bold text-slate-800 mb-1">
          {isDragging ? 'שחרר כאן...' : 'גרור קובץ CSV לכאן'}
        </p>
        <p className="text-sm text-slate-400">או לחץ לבחירת קובץ</p>

        <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-white border border-slate-100 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span>
          phone · name · labels · raw_id
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}