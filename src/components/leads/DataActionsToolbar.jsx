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

export default function DataActionsToolbar({ leads }) {
  const [showImport, setShowImport] = useState(null); // 'sheets' | 'csv' | null
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const handleSheetsImport = async () => {
    if (!sheetUrl) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await base44.functions.invoke('syncFromGoogleSheets', { sheetUrl });
      setImportResult({ success: true, added: res.data?.added || 0, updated: res.data?.updated || 0 });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importLeadsFromFile', { file_url });
      setImportResult({ success: true, added: res.data?.added || 0, updated: res.data?.updated || 0 });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${res.data?.added || 0} חדשים, ${res.data?.updated || 0} עודכנו`);
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
      toast.success(`סנכרון הושלם: ${res.data?.added || 0} חדשים, ${res.data?.updated || 0} עודכנו`);
    } catch (e) {
      toast.error('שגיאה בסנכרון: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    const newLeads = leads.filter(l => ['new', 'in_progress', 'follow_up', 'quote_sent'].includes(l.status));
    if (newLeads.length === 0) {
      toast.error('אין לידים פעילים לשליחה');
      return;
    }
    // Open first lead's WA with the message, user sends manually
    const first = newLeads[0];
    const cleanPhone = first.phone.replace(/[^0-9]/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    window.open(`https://wa.me/${israelPhone}?text=${encodeURIComponent(broadcastMsg)}`, '_blank');
    toast.success(`נפתח WhatsApp ל-${newLeads.length} לידים (שליחה ידנית)`);
    setShowBroadcast(false);
    setBroadcastMsg('');
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-[#D4AF37]" onClick={() => setShowImport('sheets')}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
          Sheets
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-[#D4AF37]" onClick={() => setShowImport('csv')}>
          <Upload className="w-3.5 h-3.5 text-slate-600" />
          CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-[#D4AF37]" onClick={handleManualSync} disabled={isSyncing}>
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
          סנכרן
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-green-500" onClick={() => setShowBroadcast(true)}>
          <Send className="w-3.5 h-3.5 text-green-600" />
          שידור
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
            <p className="text-sm text-slate-600">ודא שהגיליון כולל עמודות <strong>שם</strong> ו<strong>טלפון</strong>. לידים קיימים יעודכנו (לפי טלפון).</p>
            <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="text-sm" />
            {importResult && (
              <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {importResult.success ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{importResult.added} חדשים, {importResult.updated} עודכנו</span>
                ) : importResult.error}
              </div>
            )}
            <Button onClick={handleSheetsImport} disabled={!sheetUrl || isImporting} className="w-full">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Upload className="w-4 h-4 ml-2" />}
              ייבוא עם Upsert
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
            <p className="text-sm text-slate-600">לידים קיימים (לפי טלפון/אימייל) יעודכנו — לא ייווצרו כפילויות.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-[#FFD700]/40 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">גרור קובץ לכאן או לחץ לבחירה</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCsvUpload} className="hidden" />
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
              ההודעה תישלח ל-<strong>{leads.filter(l => ['new', 'in_progress', 'follow_up', 'quote_sent'].includes(l.status)).length}</strong> לידים פעילים.
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
              שלח שידור
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}