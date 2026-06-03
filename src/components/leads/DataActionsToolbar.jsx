import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Upload, FileSpreadsheet, RefreshCw, MessageCircle, Loader2, CheckCircle2, Send
} from 'lucide-react';
import { toast } from 'sonner';

const CONTACTABLE_STATUSES = ['ליד חדש', 'נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'new', 'new lead', 'in_progress', 'follow_up', 'quote_sent'];
const DEFAULT_BROADCAST_MESSAGE = 'היי, מה קורה? ראיתי שהשארת פרטים לגבי שירותי צילום, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?';

const getContactableLeads = (leads = []) => leads.filter((lead) => {
  const phoneDigits = String(lead.phone || '').replace(/[^0-9]/g, '');
  const status = String(lead.status || 'ליד חדש').toLowerCase();
  return phoneDigits.length >= 7 && CONTACTABLE_STATUSES.map((s) => s.toLowerCase()).includes(status);
});

const toWhatsAppPhone = (phone = '') => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('972')) return cleanPhone;
  return cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
};

export default function DataActionsToolbar({ leads }) {
  const [showImport, setShowImport] = useState(null); // 'sheets' | 'csv' | null
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState(DEFAULT_BROADCAST_MESSAGE);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const handleSheetsImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const payload = sheetUrl.trim() ? { sheetUrl: sheetUrl.trim() } : {};
      const res = await base44.functions.invoke('syncFromGoogleSheets', payload);
      setImportResult({ success: true, added: res.data?.added || 0, updated: res.data?.updated || 0 });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
      toast.success(`${res.data?.added || 0} חדשים, ${res.data?.updated || 0} עודכנו`);
    } catch (e) {
      setImportResult({ success: false, error: e.message });
      toast.error('שגיאה: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buffer);
      const leads = text
        .split(/\r?\n/)
        .map((row) => row.split(','))
        .map((values) => {
          const rawPhone = String(values[0] || '');
          const digits = rawPhone.replace(/[^0-9]/g, '');
          const phone = digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
          const fullName = String(values[2] || '').trim().replace(/^"|"$/g, '');
          const firstName = String(values[1] || '').trim().replace(/^"|"$/g, '');
          const name = fullName || firstName;

          if (!phone || !name) return null;

          return {
            phone,
            name,
            status: 'ליד חדש',
            source: 'WhatsApp JONI',
          };
        })
        .filter(Boolean);

      if (leads.length === 0) {
        setImportResult({ success: false, error: 'לא נמצאו לידים תקינים בקובץ' });
        toast.error('לא נמצאו לידים תקינים בקובץ');
        return;
      }

      const res = await base44.functions.invoke('importJoniLeads', { leads });
      const imported = res.data?.imported || leads.length;
      setImportResult({ success: true, added: imported, updated: 0 });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
      toast.success(`${imported} לידים יובאו בהצלחה`);
    } catch (err) {
      setImportResult({ success: false, error: err.message });
      toast.error('שגיאה בייבוא');
    } finally {
      setIsImporting(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await base44.functions.invoke('syncFromGoogleSheets', {});
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
      toast.success(`סנכרון הושלם: ${res.data?.added || 0} חדשים, ${res.data?.updated || 0} עודכנו`);
    } catch (e) {
      toast.error('שגיאה בסנכרון: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    const contactableLeads = getContactableLeads(leads);
    if (contactableLeads.length === 0) {
      toast.error('אין לידים חדשים/פעילים עם טלפון תקין לשליחה');
      return;
    }
    const first = contactableLeads[0];
    window.open(`https://wa.me/${toWhatsAppPhone(first.phone)}?text=${encodeURIComponent(broadcastMsg)}`, '_blank');
    toast.success(`נפתח WhatsApp לליד הראשון מתוך ${contactableLeads.length} לידים מתאימים`);
    setShowBroadcast(false);
    setBroadcastMsg(DEFAULT_BROADCAST_MESSAGE);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full max-w-full">
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full sm:w-auto gap-1.5 text-xs font-bold text-slate-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
          onClick={handleManualSync}
          disabled={isSyncing}
          title="סנכרון מגוגל שיטס"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'מסנכרן...' : 'סנכרן'}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full sm:w-auto gap-1.5 text-xs font-bold text-slate-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
          onClick={() => setShowImport('sheets')}
          title="ייבוא מ-Google Sheets"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
          <span>Sheets</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full sm:w-auto gap-1.5 text-xs font-bold text-slate-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
          onClick={() => setShowImport('csv')}
          title="העלאת קובץ CSV / Excel"
        >
          <Upload className="w-3.5 h-3.5 text-slate-600" />
          <span>CSV</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full sm:w-auto col-span-2 sm:col-span-1 gap-1.5 text-xs font-bold text-green-700 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 shadow-sm"
          onClick={() => setShowBroadcast(true)}
          title="שידור WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5 text-green-600" />
          <span>WhatsApp</span>
        </Button>
      </div>

      {/* Sheets Import Dialog */}
      <Dialog open={showImport === 'sheets'} onOpenChange={(o) => !o && setShowImport(null)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              ייבוא מ-Google Sheets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">אפשר להדביק URL של Google Sheets או להשאיר ריק כדי לסנכרן את הגיליון הקבוע. לידים קיימים יעודכנו לפי טלפון.</p>
            <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="אופציונלי: https://docs.google.com/spreadsheets/d/..." className="text-sm" />
            {importResult && (
              <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {importResult.success ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{importResult.added} חדשים, {importResult.updated} עודכנו</span>
                ) : importResult.error}
              </div>
            )}
            <Button onClick={handleSheetsImport} disabled={isImporting} className="w-full">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Upload className="w-4 h-4 ml-2" />}
              סנכרן עכשיו
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImport === 'csv'} onOpenChange={(o) => !o && setShowImport(null)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              העלאת קובץ CSV / Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">ייבוא CSV לפי עמודות קבועות: 1 טלפון, 2 שם פרטי, 3 שם מלא. הלידים הקיימים יימחקו לפני הייבוא.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-[#FFD700]/40 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">גרור קובץ לכאן או לחץ לבחירה</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleCsvUpload} className="hidden" />
            </div>
            {isImporting && (
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">מעבד...</span>
              </div>
            )}
            {importResult && (
              <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {importResult.success ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{importResult.added} חדשים, {importResult.updated} עודכנו</span>
                ) : importResult.error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Broadcast Dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              שידור WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">
              ההודעה תיפתח ידנית ב-WhatsApp עבור <strong>{getContactableLeads(leads).length}</strong> לידים חדשים/פעילים עם טלפון תקין.
            </p>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="הודעת שידור..."
              className="w-full px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-sm"
              rows="4"
            />
            <Button onClick={handleBroadcast} disabled={!broadcastMsg.trim()} className="w-full gap-2">
              <Send className="w-4 h-4" />
              פתח פנייה ב-WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}