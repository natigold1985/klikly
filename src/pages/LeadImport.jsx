import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, MessageCircle, Instagram, Facebook, Mail, Loader2, CheckCircle2, Linkedin } from 'lucide-react';
import { toast } from 'sonner';

const CHANNELS = [
  { id: 'sheets', label: 'Google Sheets', desc: 'ייבוא גורף מגיליון', icon: FileSpreadsheet, color: 'bg-green-500', available: true },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'לידים מתוויות/תגיות', icon: MessageCircle, color: 'bg-[#25D366]', available: false },
  { id: 'facebook', label: 'Facebook Ads', desc: 'סנכרון ישיר מ-Lead Ads', icon: Facebook, color: 'bg-blue-600', available: false },
  { id: 'instagram', label: 'Instagram', desc: 'טפסי לידים באינסטגרם', icon: Instagram, color: 'bg-gradient-to-tr from-purple-500 to-pink-500', available: false },
  { id: 'email', label: 'Gmail', desc: 'ניתוח אוטומטי של טפסי "צור קשר"', icon: Mail, color: 'bg-red-500', available: false },
  { id: 'linkedin', label: 'LinkedIn', desc: 'לידים מקמפיינים ופרופילים', icon: Linkedin, color: 'bg-[#0A66C2]', available: false },
  { id: 'csv', label: 'העלאת קובץ CSV', desc: 'ייבוא ידני מקובץ', icon: Upload, color: 'bg-slate-700', available: true },
];

export default function LeadImport() {
  const [activeChannel, setActiveChannel] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const queryClient = useQueryClient();

  const handleSheetsImport = async () => {
    if (!sheetUrl) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await base44.functions.invoke('syncFromGoogleSheets', { sheetUrl });
      setImportResult({ success: true, count: res.data?.imported || 0 });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${res.data?.imported || 0} לידים יובאו בהצלחה`);
    } catch (e) {
      setImportResult({ success: false, error: e.message });
      toast.error('שגיאה בייבוא: ' + e.message);
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
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  shooting_type: { type: 'string' },
                  source: { type: 'string' },
                  notes: { type: 'string' },
                }
              }
            }
          }
        }
      });

      if (extracted.status === 'success' && extracted.output?.leads) {
        const rawLeads = extracted.output.leads.filter(l => l.name && l.phone);
        if (rawLeads.length > 0) {
          // Upsert: check for existing leads by phone/email
          const existingLeads = await base44.entities.Lead.list('-created_date', 500);
          const existingPhones = new Set(existingLeads.map(l => l.phone?.replace(/[^0-9]/g, '')));
          const existingEmails = new Set(existingLeads.filter(l => l.email).map(l => l.email.toLowerCase()));
          
          const newLeads = [];
          let updatedCount = 0;
          
          for (const l of rawLeads) {
            const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
            const normalizedEmail = l.email?.toLowerCase();
            const existingByPhone = existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone);
            const existingByEmail = normalizedEmail && existingLeads.find(ex => ex.email?.toLowerCase() === normalizedEmail);
            const existing = existingByPhone || existingByEmail;
            
            if (existing) {
              // Update existing lead with new data (only non-empty fields)
              const updateData = {};
              if (l.shooting_type && !existing.shooting_type) updateData.shooting_type = l.shooting_type;
              if (l.source && !existing.source) updateData.source = l.source;
              if (l.notes) updateData.notes = [existing.notes, l.notes].filter(Boolean).join(' | ');
              if (l.email && !existing.email) updateData.email = l.email;
              if (Object.keys(updateData).length > 0) {
                await base44.entities.Lead.update(existing.id, updateData);
                updatedCount++;
              }
            } else {
              newLeads.push(l);
            }
          }
          
          if (newLeads.length > 0) {
            await base44.entities.Lead.bulkCreate(newLeads.map(l => ({
              ...l,
              status: 'new',
              source: l.source || 'CSV Import',
              last_contact_date: new Date().toISOString(),
            })));
          }
          
          setImportResult({ success: true, count: newLeads.length, updated: updatedCount });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          toast.success(`${newLeads.length} חדשים, ${updatedCount} עודכנו`);
        } else {
          setImportResult({ success: false, error: 'לא נמצאו לידים עם שם וטלפון' });
        }
      } else {
        setImportResult({ success: false, error: extracted.details || 'שגיאה בעיבוד הקובץ' });
      }
    } catch (err) {
      setImportResult({ success: false, error: err.message });
      toast.error('שגיאה בייבוא CSV');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">ייבוא לידים</h1>
        <p className="text-slate-500 mt-1">קלוט לידים מכל ערוץ — במקום אחד</p>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          return (
            <Card
              key={ch.id}
              className={`border rounded-2xl transition-all cursor-pointer group ${
                ch.available
                  ? 'hover:border-[#FFD700]/40 hover:shadow-lg active:scale-[0.98]'
                  : 'opacity-50 cursor-not-allowed'
              } ${activeChannel === ch.id ? 'border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.15)]' : ''}`}
              onClick={() => ch.available && setActiveChannel(ch.id)}
            >
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-xl ${ch.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">{ch.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ch.desc}</p>
                </div>
                {!ch.available && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">בקרוב</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Google Sheets Import */}
      <Dialog open={activeChannel === 'sheets'} onOpenChange={(open) => !open && setActiveChannel(null)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              ייבוא מ-Google Sheets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">הזן את הכתובת של הגיליון. ודא שהעמודות כוללות לפחות <strong>שם</strong> ו<strong>טלפון</strong>.</p>
            <Input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="text-sm"
            />
            {importResult && (
              <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {importResult.success ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {importResult.count} חדשים{importResult.updated > 0 ? `, ${importResult.updated} עודכנו` : ' יובאו'}
                  </span>
                ) : importResult.error}
              </div>
            )}
            <Button onClick={handleSheetsImport} disabled={!sheetUrl || isImporting} className="w-full">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Upload className="w-4 h-4 ml-2" />}
              התחל ייבוא
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import */}
      <Dialog open={activeChannel === 'csv'} onOpenChange={(open) => !open && setActiveChannel(null)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-slate-700" />
              העלאת קובץ CSV / Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">העלה קובץ עם עמודות: שם, טלפון, אימייל, סוג צילום, מקור.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-[#FFD700]/40 transition-colors">
              <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">גרור קובץ לכאן או לחץ לבחירה</p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" size="sm" asChild className="cursor-pointer">
                  <span>בחר קובץ</span>
                </Button>
              </label>
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
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {importResult.count} חדשים{importResult.updated > 0 ? `, ${importResult.updated} עודכנו` : ''}
                  </span>
                ) : importResult.error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}