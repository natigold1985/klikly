import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, MessageCircle, Instagram, Facebook, Mail, Loader2, CheckCircle2, Linkedin, RefreshCw, Clock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const AI_CHANNELS = ['facebook', 'instagram', 'whatsapp', 'email', 'linkedin'];
const AI_CHANNEL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  email: 'Gmail',
  linkedin: 'LinkedIn',
};
const AI_CHANNEL_HINTS = {
  facebook: 'הדבק כאן טקסט מ-Lead Ads, הודעות פייסבוק, או פוסטים שכוללים פרטי לקוחות',
  instagram: 'הדבק כאן הודעות DM, תגובות, או טפסי לידים מאינסטגרם',
  whatsapp: 'הדבק כאן שיחות ווטסאפ, או רשימת שמות ומספרים מקבוצות',
  email: 'הדבק כאן תוכן מיילים, טפסי "צור קשר", או רשימות מנויים',
  linkedin: 'הדבק כאן הודעות InMail, פניות, או פרופילים מ-LinkedIn',
};

const CHANNELS = [
  { id: 'gmail_auto', label: 'Gmail סריקה חיה', desc: 'סריקה אוטומטית פעמיים ביום (08:00 / 17:00)', icon: Mail, color: 'bg-red-600', available: true },
  { id: 'sheets', label: 'Google Sheets', desc: 'סנכרון אוטומטי פעמיים ביום (08:00 / 17:00)', icon: FileSpreadsheet, color: 'bg-green-500', available: true },
  { id: 'facebook', label: 'Facebook Ads', desc: 'בקרוב - דורש Meta Business API', icon: Facebook, color: 'bg-blue-600', available: false },
  { id: 'instagram', label: 'Instagram', desc: 'בקרוב - דורש Meta API', icon: Instagram, color: 'bg-gradient-to-tr from-purple-500 to-pink-500', available: false },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'בקרוב - דורש WhatsApp Business API', icon: MessageCircle, color: 'bg-[#25D366]', available: false },
  { id: 'email', label: 'Gmail (ידני)', desc: 'הדבק טפסי "צור קשר" מהמייל', icon: Mail, color: 'bg-red-500', available: true },
  { id: 'linkedin', label: 'LinkedIn', desc: 'בקרוב - אין API פתוח', icon: Linkedin, color: 'bg-[#0A66C2]', available: false },
  { id: 'csv', label: 'העלאת קובץ CSV', desc: 'ייבוא ידני מקובץ', icon: Upload, color: 'bg-slate-700', available: true },
];

export default function LeadImport() {
  const [activeChannel, setActiveChannel] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState({});
  const [syncingChannel, setSyncingChannel] = useState(null);
  const queryClient = useQueryClient();

  // Load last sync timestamps from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('leadImport_syncStatus');
    if (saved) setSyncStatus(JSON.parse(saved));
  }, []);

  const updateSyncStatus = (channelId) => {
    const updated = { ...syncStatus, [channelId]: new Date().toISOString() };
    setSyncStatus(updated);
    localStorage.setItem('leadImport_syncStatus', JSON.stringify(updated));
  };

  const formatLastSync = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

  const handleSheetsImport = async () => {
    if (!sheetUrl) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await base44.functions.invoke('syncFromGoogleSheets', { sheetUrl });
      setImportResult({ success: true, count: res.data?.added || 0, updated: res.data?.updated || 0 });
      updateSyncStatus('sheets');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${res.data?.added || 0} חדשים, ${res.data?.updated || 0} עודכנו`);
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
          updateSyncStatus('csv');
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

  const [pasteText, setPasteText] = useState('');
  const [gmailScanning, setGmailScanning] = useState(false);

  const handleGmailScan = async () => {
    setGmailScanning(true);
    setImportResult(null);
    try {
      const res = await base44.functions.invoke('scanGmailLeads', {});
      setImportResult({ 
        success: true, 
        count: res.data?.saved || 0, 
        updated: res.data?.updated || 0 
      });
      updateSyncStatus('gmail_auto');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`נסרקו ${res.data?.found || 0} מיילים — ${res.data?.saved || 0} לידים חדשים`);
    } catch (e) {
      setImportResult({ success: false, error: e.message });
      toast.error('שגיאה בסריקת Gmail');
    } finally {
      setGmailScanning(false);
    }
  };

  const handleAiImport = async (channelId) => {
    if (!pasteText.trim()) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract leads from this ${AI_CHANNEL_LABELS[channelId]} content. Find names, phone numbers, emails, and any context about what photography service they need.
        
Content:
${pasteText}

Return ONLY valid leads that have at least a name AND a phone number.`,
        response_json_schema: {
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
                  notes: { type: 'string' },
                }
              }
            }
          }
        }
      });

      const leads = (result.leads || []).filter(l => l.name && l.phone);
      if (leads.length === 0) {
        setImportResult({ success: false, error: 'לא נמצאו לידים עם שם וטלפון בטקסט' });
        return;
      }

      // Upsert logic
      const existingLeads = await base44.entities.Lead.list('-created_date', 500);
      const newLeads = [];
      let updatedCount = 0;

      for (const l of leads) {
        const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
        const existing = existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone);
        if (existing) {
          const updateData = {};
          if (l.shooting_type && !existing.shooting_type) updateData.shooting_type = l.shooting_type;
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
          source: AI_CHANNEL_LABELS[channelId],
          last_contact_date: new Date().toISOString(),
        })));
      }

      setImportResult({ success: true, count: newLeads.length, updated: updatedCount });
      updateSyncStatus(channelId);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${newLeads.length} חדשים, ${updatedCount} עודכנו`);
      setPasteText('');
    } catch (e) {
      setImportResult({ success: false, error: e.message });
      toast.error('שגיאה בעיבוד: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">ייבוא לידים</h1>
        <p className="text-slate-500 mt-1">בחר ערוץ, הדבק טקסט או חבר חשבון — ה-AI מחלץ את הלידים אוטומטית</p>
      </div>
      <Card className="border border-blue-100 bg-blue-50/50 rounded-2xl">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-bold text-sm text-blue-800 mb-1">איך זה עובד?</p>
            <p><strong>Gmail סריקה חיה</strong> — מחובר ל-Gmail שלך, סורק מיילים חדשים אוטומטית ומזהה פניות צילום.</p>
            <p><strong>Google Sheets</strong> — מתחבר לגיליון ומייבא שורות אוטומטית (צריך URL של גיליון).</p>
            <p><strong>הערוצים האחרים</strong> — הדבק טקסט מכל מקור (פייסבוק, ווטסאפ, אינסטגרם, LinkedIn) וה-AI יחלץ ממנו שמות, טלפונים ומיילים.</p>
          </div>
        </CardContent>
      </Card>

      {/* Channel Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          const lastSync = syncStatus[ch.id];
          const lastSyncLabel = formatLastSync(lastSync);
          return (
            <Card
              key={ch.id}
              className={`border rounded-2xl transition-all cursor-pointer group ${
                ch.available
                  ? 'hover:border-[#C5A028]/40 hover:shadow-lg active:scale-[0.98]'
                  : 'opacity-50 cursor-not-allowed'
              } ${activeChannel === ch.id ? 'border-[#C5A028] shadow-md' : ''}`}
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
                {ch.available && lastSyncLabel ? (
                  <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    סונכרן {lastSyncLabel}
                  </span>
                ) : ch.available ? (
                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    סנכרן עכשיו
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">בקרוב</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gmail Auto Scan */}
      <Dialog open={activeChannel === 'gmail_auto'} onOpenChange={(open) => !open && setActiveChannel(null)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-red-600" />
              סריקת Gmail חיה (AI)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">
              סריקה אוטומטית של תיבת Gmail שלך לזיהוי פניות צילום, טפסי "צור קשר", והרשמות.
              הסריקה גם רצה אוטומטית כל פעם שנכנס מייל חדש.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Gmail מחובר — סריקה אוטומטית פעילה
            </div>
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
            <Button onClick={handleGmailScan} disabled={gmailScanning} className="w-full gap-2">
              {gmailScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              סרוק עכשיו
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
      {/* AI Paste Import Dialog (for Facebook, Instagram, WhatsApp, Gmail, LinkedIn) */}
      {AI_CHANNELS.map(chId => (
        <Dialog key={chId} open={activeChannel === chId} onOpenChange={(open) => { if (!open) { setActiveChannel(null); setImportResult(null); } }}>
          <DialogContent className="sm:max-w-[520px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C5A028]" />
                ייבוא AI מ-{AI_CHANNEL_LABELS[chId]}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-slate-600">{AI_CHANNEL_HINTS[chId]}</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="הדבק טקסט כאן..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#FFD700] focus:outline-none min-h-[160px] resize-y"
                dir="auto"
              />
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
              <Button onClick={() => handleAiImport(chId)} disabled={!pasteText.trim() || isImporting} className="w-full gap-2">
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                נתח וייבא לידים
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}