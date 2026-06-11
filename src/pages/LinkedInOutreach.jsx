import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Linkedin, Plus, RefreshCw, 
  Calendar, MessageCircle, Clock, 
  UserPlus, Send, ExternalLink, Star, Trash2, Link
} from 'lucide-react';
import { toast } from 'sonner';
import LinkedInAddLeadDialog from '@/components/linkedin/LinkedInAddLeadDialog';
import LinkedInFollowUpDialog from '@/components/linkedin/LinkedInFollowUpDialog';

// Outreach-specific statuses — NOT the same as Lead statuses
const STATUS_CONFIG = {
  'new':          { label: 'טרם פנייה',              color: 'bg-slate-100 text-slate-600 border-slate-200',     dot: 'bg-slate-400' },
  'request_sent': { label: 'נשלחה בקשת חברות',       color: 'bg-cyan-100 text-cyan-800 border-cyan-200',        dot: 'bg-cyan-500' },
  'contacted':    { label: 'נשלחה פנייה',             color: 'bg-blue-100 text-blue-800 border-blue-200',        dot: 'bg-blue-500' },
  'follow_up':    { label: 'מעקב',                   color: 'bg-yellow-100 text-yellow-800 border-yellow-200',  dot: 'bg-yellow-500' },
  'messaged':     { label: 'נשלחה הודעה ראשונה',      color: 'bg-purple-100 text-purple-800 border-purple-200',  dot: 'bg-purple-500' },
  'converted':    { label: 'נסגר — הפך לליד ✅',     color: 'bg-green-100 text-green-800 border-green-200',    dot: 'bg-green-500' },
  'dismissed':    { label: 'לא רלוונטי',              color: 'bg-red-100 text-red-800 border-red-200',          dot: 'bg-red-500' },
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function LinkedInOutreach() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState('הכל');
  const [isSyncing, setIsSyncing] = useState(false);
  const [convertingId, setConvertingId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['linkedinOutreach'],
    queryFn: () => base44.entities.PotentialLead.filter({ platform: 'linkedin' }, '-created_date', 300),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PotentialLead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedinOutreach'] }),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id) => base44.entities.PotentialLead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedinOutreach'] });
      toast.success('נמחק');
    },
  });

  const handleDelete = (lead) => {
    const name = (lead.title || '').split(' - ')[0];
    if (confirm(`למחוק את ${name}?`)) {
      deleteLeadMutation.mutate(lead.id);
    }
  };

  const handleStatusChange = async (lead, newStatus) => {
    // If converting to a real lead — create a Lead entity
    if (newStatus === 'converted') {
      setConvertingId(lead.id);
      try {
        const titleParts = (lead.title || '').split(' - ');
        const name = titleParts[0] || lead.title || '';
        const jobTitle = titleParts[1] || '';
        const email = (lead.contact_info || '').split('/')[0].trim().replace('לא זמין', '').trim();

        await base44.entities.Lead.create({
          name,
          phone: (lead.contact_info || '').split('/')[1]?.trim().replace('לא זמין', '').trim() || '',
          email: email || '',
          source: 'LinkedIn Outreach',
          role_title: jobTitle,
          notes: `מקור: LinkedIn Outreach\n${lead.source_url ? 'פרופיל: ' + lead.source_url : ''}\n${lead.notes || ''}`.trim(),
          status: 'ליד חדש',
          pipeline: 'defense_industry',
        });

        await updateLeadMutation.mutateAsync({ id: lead.id, data: { status: 'converted' } });
        toast.success(`✅ ${name} נוסף לרשימת הלידים!`);
      } catch (e) {
        toast.error('שגיאה ביצירת ליד: ' + e.message);
      } finally {
        setConvertingId(null);
      }
      return;
    }

    const updateData = { status: newStatus };
    if (newStatus === 'contacted' && !lead.contact_date) {
      updateData.contact_date = new Date().toISOString().split('T')[0];
    }
    await updateLeadMutation.mutateAsync({ id: lead.id, data: updateData });
    toast.success(`סטטוס עודכן: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await base44.functions.invoke('syncLinkedInOutreachToSheet', { syncAll: true });
      toast.success(`✅ סונכרנו ${res.data?.synced || 0} לידים לגוגל שיטס`);
    } catch (e) {
      toast.error('שגיאה בסנכרון לגוגל שיטס');
    } finally {
      setIsSyncing(false);
    }
  };

  // Active outreach = exclude converted & dismissed from default view
  const FILTER_TABS = ['הכל', 'טרם פנייה', 'נשלחה בקשת חברות', 'נשלחה פנייה', 'מעקב', 'נשלחה הודעה ראשונה', 'נסגר כליד', 'לא רלוונטי'];

  const statusKeyForLabel = (label) => {
    const map = {
      'טרם פנייה': 'new',
      'נשלחה בקשת חברות': 'request_sent',
      'נשלחה פנייה': 'contacted',
      'מעקב': 'follow_up',
      'נשלחה הודעה ראשונה': 'messaged',
      'נסגר כליד': 'converted',
      'לא רלוונטי': 'dismissed',
    };
    return map[label];
  };

  const filtered = filterStatus === 'הכל'
    ? leads
    : leads.filter(l => l.status === statusKeyForLabel(filterStatus));

  const countForFilter = (label) => {
    if (label === 'הכל') return leads.length;
    const s = statusKeyForLabel(label);
    return leads.filter(l => l.status === s).length;
  };

  const stats = {
    total: leads.filter(l => l.status !== 'dismissed').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    followUp: leads.filter(l => l.status === 'follow_up' || l.status === 'messaged').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Linkedin className="w-7 h-7 text-blue-600" />
            LinkedIn Outreach
          </h1>
          <p className="text-sm text-slate-500 mt-1">ניהול פניות אקטיביות — כשנסגר הופך לליד אמיתי</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            סנכרן לשיטס
          </Button>
          <a
            href="https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit?gid=1694943082#gid=1694943082"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-300 text-green-700 hover:bg-green-50 text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            פתח שיטס
          </a>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            הוסף איש קשר
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'בתהליך', value: stats.total, IconComp: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'נשלחה פנייה', value: stats.contacted, IconComp: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'במעקב / הודעה', value: stats.followUp, IconComp: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'נסגרו כלידים', value: stats.converted, IconComp: Star, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, IconComp, color, bg }) => (
          <Card key={label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`p-2 rounded-xl ${bg}`}>
                  <IconComp className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filterStatus === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {s}
            <span className="mr-1 opacity-60">({countForFilter(s)})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-right py-3 px-4 font-semibold text-slate-600">שם</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">חברה / תפקיד</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">סטטוס פנייה</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> תאריך פנייה</span>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">ימים</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">הערות</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">טוען...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Linkedin className="w-10 h-10 opacity-30" />
                      <p>אין אנשי קשר עדיין</p>
                      <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-blue-600 text-white">
                        <Plus className="w-4 h-4 ml-1" /> הוסף ראשון
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((lead) => {
                const titleParts = (lead.title || '').split(' - ');
                const name = titleParts[0] || lead.title || '—';
                const jobTitle = titleParts[1] || '';
                const company = (lead.snippet || '').split(' - ')[0] || '';
                const contactDate = lead.contact_date || (lead.status === 'contacted' ? lead.updated_date : null);
                // Extract outreach URL from notes if stored there
                const outreachUrlMatch = (lead.notes || '').match(/🔗 קישור לשליחה: (\S+)/);
                const outreachUrl = outreachUrlMatch ? outreachUrlMatch[1] : null;
                const days = daysSince(contactDate);
                const isOverdue = days !== null && days > 5 && ['contacted', 'follow_up', 'messaged'].includes(lead.status);
                const isConverted = lead.status === 'converted';

                return (
                  <tr key={lead.id} className={`border-b border-slate-100 transition-colors ${isConverted ? 'bg-green-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isConverted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {(name || '?')[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{name}</p>
                          {lead.contact_info && lead.contact_info !== 'לא זמין / לא זמין' && (
                            <p className="text-xs text-slate-400">{lead.contact_info.split('/')[0].trim()}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-700 font-medium">{jobTitle}</p>
                      <p className="text-xs text-slate-400">{company}</p>
                    </td>
                    <td className="py-3 px-4">
                      {isConverted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-200">
                          <Star className="w-3 h-3" /> נסגר — הפך לליד
                        </span>
                      ) : (
                        <select
                          value={lead.status || 'new'}
                          onChange={(e) => handleStatusChange(lead, e.target.value)}
                          disabled={convertingId === lead.id}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[180px]"
                        >
                          <option value="new">טרם פנייה</option>
                          <option value="request_sent">נשלחה בקשת חברות</option>
                          <option value="contacted">נשלחה פנייה</option>
                          <option value="follow_up">מעקב</option>
                          <option value="messaged">נשלחה הודעה ראשונה</option>
                          <option value="converted">נסגר — הפך לליד ✅</option>
                          <option value="dismissed">לא רלוונטי</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {contactDate
                        ? new Date(contactDate).toLocaleDateString('he-IL')
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {days !== null ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isOverdue ? 'bg-red-100 text-red-700' : days > 2 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          <Clock className="w-3 h-3" />{days}י
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 max-w-[140px]">
                      <p className="text-xs text-slate-500 truncate" title={lead.notes}>
                        {(lead.notes || '').replace(/🔗 קישור לשליחה: \S+/, '').trim() || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {/* LinkedIn: show profile link if valid /in/ URL, else show search link */}
                        {lead.source_url ? (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title={lead.source_url.includes('/search/') ? 'חפש באינדקס LinkedIn' : 'פתח פרופיל LinkedIn'}
                          >
                            <Linkedin className={`w-4 h-4 ${lead.source_url.includes('/search/') ? 'opacity-50' : ''}`} />
                          </a>
                        ) : (
                          <a
                            href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((lead.title || '').split(' - ')[0] + ' ' + ((lead.snippet || '').split(' - ')[0]))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 transition-colors"
                            title="חפש ב-LinkedIn"
                          >
                            <Linkedin className="w-4 h-4 opacity-50" />
                          </a>
                        )}
                        {!isConverted && (
                          <button
                            onClick={() => setFollowUpLead(lead)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                            title="הוסף הערה / פולו-אפ"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(lead)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <LinkedInAddLeadDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['linkedinOutreach'] });
          toast.success('איש קשר נוסף ✓');
        }}
      />

      {followUpLead && (
        <LinkedInFollowUpDialog
          lead={followUpLead}
          open={!!followUpLead}
          onOpenChange={(open) => !open && setFollowUpLead(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['linkedinOutreach'] });
            setFollowUpLead(null);
          }}
        />
      )}
    </div>
  );
}