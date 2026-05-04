import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardPaste, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Parse pasted rows (TSV/CSV) from Google Sheets.
// Expected columns (in order, all optional except name+phone):
// name, phone, source, location/role/company, type, link/url, date, notes
// We are flexible — auto-detect phone by digit pattern, email by @, url by http.
function parseRow(rawLine) {
  // Split by tab first (Google Sheets default), fall back to multiple spaces or commas
  let cells = rawLine.includes('\t')
    ? rawLine.split('\t')
    : rawLine.includes(',')
    ? rawLine.split(',')
    : rawLine.split(/\s{2,}/);

  cells = cells.map(c => (c || '').trim()).filter(c => c !== '');
  if (cells.length < 2) return null;

  const lead = {
    name: '',
    phone: '',
    email: '',
    source: '',
    shooting_type: '',
    notes: '',
  };

  const remaining = [];

  for (const cell of cells) {
    const phoneDigits = cell.replace(/[^0-9]/g, '');
    const isPhone = !lead.phone && /^[\+\d\-\s\(\)]+$/.test(cell) && phoneDigits.length >= 9 && phoneDigits.length <= 15;
    const isEmail = !lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell);
    const isUrl = /^https?:\/\//i.test(cell);

    if (isPhone) {
      lead.phone = cell;
    } else if (isEmail) {
      lead.email = cell;
    } else if (isUrl) {
      // URL goes into notes as "קישור: ..."
      lead.notes = lead.notes ? `${lead.notes} | קישור: ${cell}` : `קישור: ${cell}`;
    } else {
      remaining.push(cell);
    }
  }

  // First non-phone/email/url cell = name
  // Second = source (if looks like source-ish)
  // Rest = notes
  if (remaining.length > 0) lead.name = remaining[0];
  if (remaining.length > 1) {
    // Second cell is usually source
    lead.source = remaining[1];
  }
  if (remaining.length > 2) {
    // Cells 3+ go into notes
    const extraNotes = remaining.slice(2).join(' | ');
    lead.notes = lead.notes ? `${extraNotes} | ${lead.notes}` : extraNotes;
  }

  if (!lead.name || !lead.phone) return null;
  return lead;
}

export default function PasteLeadsDialog({ open, onOpenChange }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const queryClient = useQueryClient();

  const handlePreview = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(parseRow).filter(Boolean);
    setPreview(parsed);
    setResult(null);
  };

  const handleImport = async () => {
    if (preview.length === 0) {
      toast.error('אין לידים לייבוא — לחץ "תצוגה מקדימה" קודם');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      // Fetch existing leads for dedup
      const existingLeads = await base44.entities.Lead.list('-created_date', 1000);

      const newLeads = [];
      let updatedCount = 0;

      for (const l of preview) {
        const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
        const normalizedEmail = l.email?.toLowerCase();
        const existing = existingLeads.find(ex => {
          const exPhone = ex.phone?.replace(/[^0-9]/g, '');
          const exEmail = ex.email?.toLowerCase();
          return (normalizedPhone && exPhone === normalizedPhone) ||
                 (normalizedEmail && exEmail === normalizedEmail);
        });

        if (existing) {
          const updateData = {};
          if (l.shooting_type && !existing.shooting_type) updateData.shooting_type = l.shooting_type;
          if (l.source && !existing.source) updateData.source = l.source;
          if (l.email && !existing.email) updateData.email = l.email;
          if (l.notes) updateData.notes = [existing.notes, l.notes].filter(Boolean).join(' | ');
          if (Object.keys(updateData).length > 0) {
            await base44.entities.Lead.update(existing.id, updateData);
            updatedCount++;
          }
        } else {
          newLeads.push({
            ...l,
            status: 'new',
            source: l.source || 'הדבקה ידנית',
            last_contact_date: new Date().toISOString(),
          });
        }
      }

      if (newLeads.length > 0) {
        await base44.entities.Lead.bulkCreate(newLeads);
      }

      setResult({ success: true, added: newLeads.length, updated: updatedCount });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${newLeads.length} חדשים, ${updatedCount} עודכנו`);
      setText('');
      setPreview([]);
    } catch (e) {
      setResult({ success: false, error: e.message });
      toast.error('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-[#C5A028]" />
            הדבקת לידים מטבלה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            <p className="font-bold text-blue-800 mb-1">איך משתמשים?</p>
            <p>סמן שורות בגוגל שיטס/אקסל (Ctrl+A או Ctrl+Shift+End), העתק (Ctrl+C), והדבק כאן.</p>
            <p className="mt-1">הפורמט גמיש — המערכת מזהה אוטומטית טלפון, מייל, קישורים, שם ומקור.</p>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`ליאור מרקוביץ\t050-2345678\tGoogle Search\tצפון ת"א\tחובב צילום\thttps://...\n...`}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#FFD700] focus:outline-none min-h-[200px] resize-y"
            dir="ltr"
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={!text.trim()} className="flex-1">
              תצוגה מקדימה
            </Button>
            <Button onClick={handleImport} disabled={preview.length === 0 || busy} className="flex-1 gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              ייבא {preview.length > 0 ? `(${preview.length})` : ''}
            </Button>
          </div>

          {preview.length > 0 && !result && (
            <div className="border border-slate-200 rounded-xl p-3 max-h-60 overflow-y-auto">
              <p className="text-xs font-bold text-slate-700 mb-2">זוהו {preview.length} לידים:</p>
              <ul className="space-y-1.5">
                {preview.slice(0, 20).map((l, i) => (
                  <li key={i} className="text-xs text-slate-600 border-b border-slate-100 pb-1.5 last:border-0">
                    <span className="font-bold text-slate-900">{l.name}</span>
                    <span className="text-slate-400"> · </span>
                    <span dir="ltr" className="font-mono">{l.phone}</span>
                    {l.source && <><span className="text-slate-400"> · </span><span className="text-[#C5A028]">{l.source}</span></>}
                    {l.email && <><span className="text-slate-400"> · </span><span className="text-blue-600">{l.email}</span></>}
                  </li>
                ))}
                {preview.length > 20 && (
                  <li className="text-xs text-slate-400 italic">...ועוד {preview.length - 20} לידים</li>
                )}
              </ul>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              result.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {result.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{result.added} חדשים, {result.updated} עודכנו</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>{result.error}</span>
                </>
              )}
            </div>
          )}

          {text && preview.length === 0 && !busy && (
            <p className="text-xs text-slate-500 text-center">לחץ "תצוגה מקדימה" כדי לראות מה זוהה</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}