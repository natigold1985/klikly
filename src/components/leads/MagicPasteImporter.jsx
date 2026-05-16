import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MagicPasteImporter({ onComplete }) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!text.trim()) return;
    setIsImporting(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('importMagicPasteLeads', { text });
      const added = response.data?.added || 0;
      const skipped = response.data?.skipped || 0;
      setResult({ success: true, message: `${added} לידים נוספו, ${skipped} דולגו` });
      toast.success(`${added} לידים נוספו ל-New Leads Inbox`);
      setText('');
      onComplete?.(added);
    } catch (error) {
      setResult({ success: false, message: error.message });
      toast.error('שגיאה ב-Magic Paste');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-black text-slate-900">Magic Paste</h3>
          <p className="text-xs text-slate-500 mt-1">הדבק טקסט גולמי מ-WhatsApp/JONI וה-AI יזהה שמות, טלפונים והערות.</p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="הדבק כאן טקסט גולמי מתוך JONI / WhatsApp..."
        className="w-full min-h-44 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
        dir="auto"
      />

      <Button onClick={handleImport} disabled={!text.trim() || isImporting} className="w-full gap-2">
        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        נתח וייבא לידים מ-JONI
      </Button>

      {result && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.success && <CheckCircle2 className="w-4 h-4" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}