import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, MessageCircle, Instagram, Facebook, Mail, Loader2, CheckCircle2, Linkedin, RefreshCw, Clock, Sparkles, ClipboardPaste, Zap, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import PasteLeadsDialog from '@/components/leads/PasteLeadsDialog';
import LeadWebhookInfoDialog from '@/components/leads/LeadWebhookInfoDialog';
import WhatsAppCsvImporter from '@/components/leads/WhatsAppCsvImporter';
import MagicPasteImporter from '@/components/leads/MagicPasteImporter';
import WhatsAppContactsImporter from '@/components/leads/WhatsAppContactsImporter';

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
  linkedin: 'הדבק כאן פרופילים, הודעות InMail או רשימות מאנשי קשר ב-LinkedIn — ה-AI יחלץ שמות, תפקידים וחברות',
};

// Pre-built LinkedIn search queries useful for the photographer's niche
const LINKEDIN_SEARCHES = [
  { label: 'משרד הביטחון — אנשי קשר רלוונטיים', url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%9E%D7%A9%D7%A8%D7%93%20%D7%94%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F&origin=GLOBAL_SEARCH_HEADER' },
  { label: 'משרד הביטחון — דובר/יח״צ/תקשורת', url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%93%D7%95%D7%91%D7%A8%20%D7%9E%D7%A9%D7%A8%D7%93%20%D7%94%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F&origin=GLOBAL_SEARCH_HEADER' },
  { label: 'מפיקי אירועים — חברות ביטחוניות', url: 'https://www.linkedin.com/search/results/people/?keywords=%D7%9E%D7%A4%D7%99%D7%A7%20%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99%D7%9D%20%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F&origin=GLOBAL_SEARCH_HEADER' },
  { label: 'פוסטים אחרונים: "דרוש צלם"', url: 'https://www.linkedin.com/search/results/content/?keywords=%22%D7%93%D7%A8%D7%95%D7%A9%20%D7%A6%D7%9C%D7%9D%22&origin=GLOBAL_SEARCH_HEADER' },
];

const MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit?gid=2039667077#gid=2039667077';

const CHANNELS = [
  { id: 'master_sheet', label: 'סנכרון לידים אוטומטי', desc: 'קורא את כל הטאבים מה-Sheet המאסטר, מוסיף רק לידים עם שם + טלפון/מייל', icon: Zap, color: 'bg-emerald-600', available: true, directSync: true },
  { id: 'gmail_auto', label: 'Gmail סריקה חיה', desc: 'סריקה אוטומטית פעמיים ביום (09:00 / 21:00)', icon: Mail, color: 'bg-red-600', available: true },
  { id: 'sheets', label: 'Google Sheets (ידני)', desc: 'סנכרון מכל Sheet — ללא AI, ניתן לשנות URL', icon: FileSpreadsheet, color: 'bg-green-500', available: true },
  { id: 'facebook', label: 'Facebook Ads', desc: 'Webhook Native מ-Meta Lead Ads', icon: Facebook, color: 'bg-blue-600', available: true, webhook: true },
  { id: 'instagram', label: 'Instagram', desc: 'Webhook Native מ-Meta / Instagram', icon: Instagram, color: 'bg-gradient-to-tr from-purple-500 to-pink-500', available: true, webhook: true },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'Webhook Native מ-WhatsApp Business', icon: MessageCircle, color: 'bg-[#25D366]', available: true, webhook: true },
  { id: 'email', label: 'Gmail (ידני)', desc: 'הדבק טפסי "צור קשר" מהמייל', icon: Mail, color: 'bg-red-500', available: true },
  { id: 'linkedin', label: 'LinkedIn', desc: 'חיפוש מוכוון + הדבקת תוצאות', icon: Linkedin, color: 'bg-[#0A66C2]', available: true },
  { id: 'csv', label: 'העלאת קובץ CSV / Excel', desc: 'ייבוא לפי כותרות בעברית', icon: Upload, color: 'bg-slate-700', available: true },
  { id: 'wa_contacts', label: 'ייצוא אנשי קשר WhatsApp', desc: 'קובץ CSV מתוסף WhatsApp Lead Manager', icon: MessageCircle, color: 'bg-[#25D366]', available: true },
  { id: 'paste', label: 'הדבקה מ-Sheets', desc: 'העתק שורות והדבק ישירות', icon: ClipboardPaste, color: 'bg-[#C5A028]', available: true },
];

export default function LeadImport() {
  const [activeChannel, setActiveChannel] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit?gid=2039667077#gid=2039667077');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState({});
  const [syncingChannel, setSyncingChannel] = useState(null);
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
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

  const [masterSyncing, setMasterSyncing] = useState(false);

  const handleMasterSheetSync = async () => {
    setMasterSyncing(true);
    setImportResult(null);
    try {
      const res = await base44.functions.invoke('runScheduledSheetsSync', {
        sheetUrl: MASTER_SHEET_URL,
        ownerEmail: undefined,
      });
      const added = res.data?.added || 0;
      const updated = res.data?.updated || 0;
      setImportResult({ success: true, count: added, updated });
      updateSyncStatus('master_sheet');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
      toast.success(`סנכרון הושלם: ${added} לידים חדשים, ${updated} עודכנו`);
    } catch (e) {
      setImportResult({ success: false, error: e.message });
      toast.error('שגיאה בסנכרון: ' + e.message);
    } finally {
      setMasterSyncing(false);
    }
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

  const [pasteText, setPasteText] = useState('');
  const [gmailScanning, setGmailScanning] = useState(false);

  const { data: gmailLogs } = useQuery({
    queryKey: ['gmailScanLogs'],
    queryFn: () => base44.entities.SystemLog.filter({ action: 'gmail_lead_scan' }, '-created_date', 10),
    staleTime: 1000 * 30,
  });

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
    <div className="space-y-8 pb-20" dir="rtl">
      {/* Page Header — consistent with sidebar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Import Hub</h1>
          <p className="text-slate-500 mt-1.5 text-sm">ייבוא לידים מ-JONI, קבצי Excel/CSV, Gmail ושאר מקורות הלידים</p>
        </div>
        <Button
          onClick={() => setActiveChannel('gmail_auto')}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          סרוק עכשיו
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MagicPasteImporter
          onComplete={() => {
            updateSyncStatus('magic_paste');
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
          }}
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900 mb-1.5">איך זה עובד?</p>
            <p><strong className="text-slate-800">Magic Paste</strong> — מדביקים טקסט גולמי מ-JONI וה-AI מייצר לידים חדשים.</p>
            <p><strong className="text-slate-800">CSV / Excel</strong> — מעלה קובץ עם כותרות בעברית ומייבא ישירות ל-New Leads Inbox.</p>
            <p><strong className="text-slate-800">Gmail / Sheets</strong> — סנכרונים קיימים נשארים זמינים בהמשך העמוד.</p>
          </div>
        </div>
      </div>

      {/* Channel Grid — premium cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          const lastSync = syncStatus[ch.id];
          const lastSyncLabel = formatLastSync(lastSync);
          return (
            <div
              key={ch.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all cursor-pointer ${
                ch.available
                  ? 'hover:shadow-md hover:border-indigo-200 active:scale-[0.98]'
                  : 'opacity-50 cursor-not-allowed'
              } ${activeChannel === ch.id ? 'border-indigo-400 shadow-md' : ''}`}
              onClick={() => {
                if (!ch.available) return;
                if (ch.webhook) { setShowWebhookInfo(true); return; }
                if (ch.directSync) { handleMasterSheetSync(); return; }
                setActiveChannel(ch.id);
              }}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-2xl ${ch.color} flex items-center justify-center shadow-md`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-base text-gray-900">{ch.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ch.desc}</p>
                </div>
                {ch.directSync && masterSyncing ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    מסנכרן...
                  </span>
                ) : ch.available && lastSyncLabel ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    סונכרן {lastSyncLabel}
                  </span>
                ) : ch.available ? (
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {ch.webhook ? 'הצג Webhook' : 'סנכרן עכשיו'}
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">בקרוב</span>
                )}
              </div>
            </div>
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

            {/* Scan history log */}
            {gmailLogs && gmailLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600">היסטוריית סריקות אחרונות</p>
                <div className="max-h-[420px] overflow-y-auto space-y-2 rounded-xl border border-slate-100 p-2 bg-slate-50">
                  {gmailLogs.map(log => {
                    let parsed = null;
                    try { parsed = JSON.parse(log.details); } catch { parsed = null; }
                    const isError = log.status === 'error';
                    const summary = parsed?.summary || log.details;
                    const leads = parsed?.leads || [];
                    return (
                      <div key={log.id} className={`rounded-xl border text-xs overflow-hidden ${isError ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                        {/* Header row */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${isError ? 'bg-red-100/60' : 'bg-slate-50'}`}>
                          {isError
                            ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                            : <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />
                          }
                          <p className={`flex-1 font-medium ${isError ? 'text-red-700' : 'text-slate-700'}`}>{summary}</p>
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(log.created_date).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {/* Leads table */}
                        {leads.length > 0 && (
                          <div className="divide-y divide-slate-100">
                            {leads.map((lead, i) => (
                              <div key={i} className="px-3 py-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                  <span>👤</span>
                                  <span>{lead.name}</span>
                                  {lead.service && <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">{lead.service}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 text-left row-span-2 self-center">
                                  {lead.slug || 'אתר'}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                                  {lead.phone && <span>📞 {lead.phone}</span>}
                                  {lead.email && <span>✉️ {lead.email}</span>}
                                  {lead.page && <a href={lead.page} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline truncate max-w-[180px]">🔗 {lead.slug || lead.page}</a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            <p className="text-sm text-slate-600">הסנכרון מתבצע דרך פונקציה ישירה מול Google Sheets — ללא AI וללא קרדיטי AI. ודא שהעמודות כוללות לפחות <strong>שם</strong> ו<strong>טלפון</strong>.</p>
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
              סנכרן עכשיו דרך פונקציה
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
          <WhatsAppCsvImporter
            onComplete={() => {
              updateSyncStatus('csv');
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['Lead'] });
              queryClient.invalidateQueries({ queryKey: ['Leads'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
            }}
          />
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

              {chId === 'linkedin' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                    <Linkedin className="w-3.5 h-3.5" />
                    חיפושים מוכנים — לחץ, חפש, העתק והדבק כאן:
                  </p>
                  <p className="text-[11px] text-blue-700/80">
                    LinkedIn לא מאפשר חיבור API לחיפוש לידים אוטומטית. אבל הכנו לך קישורי חיפוש ישירים — פתח, סמן את התוצאות הרלוונטיות (Ctrl+A → Ctrl+C), והדבק כאן.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {LINKEDIN_SEARCHES.map(s => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5"
                      >
                        <Linkedin className="w-3 h-3" />
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

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

      {/* WhatsApp Contacts Export Import */}
      <Dialog open={activeChannel === 'wa_contacts'} onOpenChange={(open) => !open && setActiveChannel(null)}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              ייצוא אנשי קשר מ-WhatsApp
            </DialogTitle>
          </DialogHeader>
          <WhatsAppContactsImporter
            onComplete={() => {
              updateSyncStatus('wa_contacts');
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard_leads'] });
              setActiveChannel(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <LeadWebhookInfoDialog
        open={showWebhookInfo}
        onOpenChange={setShowWebhookInfo}
      />

      <PasteLeadsDialog
        open={activeChannel === 'paste'}
        onOpenChange={(open) => { if (!open) setActiveChannel(null); }}
      />
    </div>
  );
}