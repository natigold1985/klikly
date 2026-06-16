import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Phone, Mail, Calendar,
  Briefcase, CheckCircle2, DollarSign, FileText, ExternalLink, UserRound, Tag, Zap, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import SendQuoteFromLeadDialog from '@/components/leads/SendQuoteFromLeadDialog';
import EditableField from '@/components/leads/EditableField';
import SourceBadge from '@/components/leads/SourceBadge';
import OutreachActions from '@/components/leads/OutreachActions';
import StatusSelect from '@/components/leads/StatusSelect';
import AutoFollowUpDialog from '@/components/leads/AutoFollowUpDialog';
import WhatsAppDesktopFollowUp from '@/components/leads/WhatsAppDesktopFollowUp.jsx';
import FollowUpHistoryFeed from '@/components/leads/FollowUpHistoryFeed.jsx';
import { enhanceLeadForDisplay } from '@/utils/leadDisplay';

export default function LeadDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showAutoFollowUpDialog, setShowAutoFollowUpDialog] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => base44.entities.Lead.get(leadId),
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', leadId],
    queryFn: () => base44.entities.Activity.filter({ related_to_type: 'lead', related_to_id: leadId }, '-created_date', 50),
    enabled: !!leadId,
  });

  const updateLeadMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities', leadId] });
      toast.success("פרטי הליד עודכנו");
    }
  });

  const updateField = (field) => async (newValue) => {
    await updateLeadMutation.mutateAsync({ [field]: newValue });
  };

  const updateStatus = async (newStatus) => {
    await updateLeadMutation.mutateAsync({ status: newStatus });
    // Sync to Google Sheets automatically
    try {
      await base44.functions.invoke('pushLeadToSheet', { data: { ...lead, status: newStatus } });
    } catch (err) {
      console.error('Failed to sync to Google Sheets:', err);
    }
  };

  const refreshLead = () => {
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['activities', leadId] });
  };

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke('deleteLeadFromGoogleSheets', { data: lead });
      return base44.entities.Lead.delete(leadId);
    },
    onSuccess: () => {
      toast.success('הליד נמחק גם מ-Google Sheets');
      navigate(-1);
    },
  });

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הליד הזה? לא ניתן לשחזר.')) {
      deleteLeadMutation.mutate();
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: (newProject) => {
      // Also update lead status to won
      updateLeadMutation.mutate({ status: 'נסגר בהצלחה' });
      toast.success("פרויקט חדש נוצר בהצלחה!");
      navigate(`/ProjectDetails?id=${newProject.id}`);
    }
  });

  if (isLoading) return <div className="p-8 text-center">טוען...</div>;
  if (!lead) return <div className="p-8 text-center">ליד לא נמצא</div>;

  const displayLead = enhanceLeadForDisplay(lead);

  const convertToProject = () => {
    createProjectMutation.mutate({
      lead_id: lead.id,
      client_name: lead.name,
      client_phone: lead.phone,
      client_email: lead.email || '',
      shooting_type: lead.shooting_type,
      status: 'pending_payment',
      shooting_date: lead.event_date,
      total_price: lead.budget || 0,
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20" dir="rtl">
      {/* Back button - prominent on both mobile and desktop */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all text-sm font-medium text-slate-700"
        >
          <ArrowRight className="w-4 h-4" />
          <span>חזרה</span>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteLeadMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 hover:bg-red-100 shadow-sm transition-all text-sm font-bold text-red-600 disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" />
          <span>מחק ליד</span>
        </button>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white border border-slate-800 shadow-2xl shadow-slate-900/20 p-6 md:p-8">
        <div className="absolute inset-y-0 left-0 w-72 bg-[#FFD700]/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-black leading-tight">{lead.name || 'תיק ליד'}</h1>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white/70">תיק ליד</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs text-white/50 mb-2">מאיפה הגיע הליד</p>
                <SourceBadge source={displayLead.source} />
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs text-white/50 mb-1">סוג ליד</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-400/20 text-purple-100 border border-purple-300/20 text-xs font-black">
                  <Tag className="w-3.5 h-3.5" /> {displayLead.lead_type || 'לא הוגדר'}
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs text-white/50 mb-1">תפקיד</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/10 text-xs font-black">
                  <UserRound className="w-3.5 h-3.5" /> {displayLead.role_title || 'לא הוגדר'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch min-w-[220px]">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
              <p className="text-xs text-white/50 mb-2">סטטוס ליד</p>
              <StatusSelect value={lead.status} onChange={updateStatus} />
            </div>
            <Button
              onClick={() => setShowAutoFollowUpDialog(true)}
              className={lead.auto_followup_enabled ? 'bg-[#FFD700] hover:bg-[#E5B800] text-black' : 'bg-white text-slate-950 hover:bg-slate-100'}
            >
              <Zap className="w-4 h-4 mr-2" />
              {lead.auto_followup_enabled ? 'פולו־אפ פעיל' : 'הפעל פולו־אפ'}
            </Button>
            {displayLead.status !== 'נסגר בהצלחה' && (
              <div className="flex gap-2">
                <Button onClick={() => setShowQuoteDialog(true)} className="flex-1 bg-[#C5A028] hover:bg-[#A88820] text-white shadow-md">
                  <FileText className="w-4 h-4 mr-2" /> הצעה
                </Button>
                <Button onClick={convertToProject} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> פרויקט
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SendQuoteFromLeadDialog
        lead={lead}
        open={showQuoteDialog}
        onOpenChange={setShowQuoteDialog}
      />

      <AutoFollowUpDialog
        lead={lead}
        open={showAutoFollowUpDialog}
        onOpenChange={setShowAutoFollowUpDialog}
        onSaved={refreshLead}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-slate-200 shadow-xl shadow-slate-200/60 rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>פרטי איש קשר</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 mb-4">לחץ על כל שדה כדי לערוך</p>
              <div className="mb-6 rounded-3xl bg-gradient-to-l from-slate-50 to-white border border-slate-200 p-5 shadow-inner">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">מקור</label>
                    <div className="py-1.5"><SourceBadge source={displayLead.source} /></div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">סוג ליד</label>
                    <EditableField value={displayLead.lead_type} onSave={updateField('lead_type')} placeholder="לא הוגדר" icon={<Tag className="w-4 h-4 text-purple-500 shrink-0" />} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">תפקיד</label>
                    <EditableField value={displayLead.role_title} onSave={updateField('role_title')} placeholder="לא הוגדר" icon={<Briefcase className="w-4 h-4 text-slate-500 shrink-0" />} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 block mb-1">סטטוס</label>
                    <StatusSelect value={lead.status} onChange={updateStatus} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">שם מלא</label>
                  <EditableField
                    value={lead.name}
                    onSave={updateField('name')}
                    placeholder="הזן שם"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">טלפון</label>
                  <EditableField
                    value={lead.phone}
                    onSave={updateField('phone')}
                    type="tel"
                    placeholder="הזן טלפון"
                    icon={<Phone className="w-4 h-4 text-slate-400 shrink-0" />}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">אימייל</label>
                  <EditableField
                    value={lead.email}
                    onSave={updateField('email')}
                    type="email"
                    placeholder="הזן אימייל"
                    icon={<Mail className="w-4 h-4 text-slate-400 shrink-0" />}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">סוג צילום</label>
                  <EditableField
                    value={lead.shooting_type}
                    onSave={updateField('shooting_type')}
                    placeholder="לא הוגדר"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תאריך אירוע</label>
                  <EditableField
                    value={lead.event_date}
                    onSave={updateField('event_date')}
                    type="date"
                    placeholder="לא נקבע"
                    icon={<Calendar className="w-4 h-4 text-slate-400 shrink-0" />}
                    formatDisplay={(v) => v ? new Date(v).toLocaleDateString('he-IL') : null}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תקציב משוער</label>
                  <EditableField
                    value={lead.budget}
                    onSave={async (v) => updateField('budget')(v ? Number(v) : null)}
                    type="number"
                    placeholder="לא צוין"
                    icon={<DollarSign className="w-4 h-4 text-slate-400 shrink-0" />}
                    formatDisplay={(v) => v ? `₪${Number(v).toLocaleString()}` : null}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-500 block mb-1">קישור לפוסט המקורי</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 min-w-0">
                      <EditableField
                        value={lead.source_post_url}
                        onSave={updateField('source_post_url')}
                        placeholder="הדבק כאן קישור מדויק לפוסט / מודעה"
                      />
                    </div>
                    {lead.source_post_url && (
                      <a
                        href={lead.source_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 text-sm font-bold transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        פתח פוסט
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <WhatsAppDesktopFollowUp lead={displayLead} onDone={refreshLead} />
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <label className="text-sm text-slate-500 block mb-2">הערות</label>
                <EditableField
                  value={lead.notes}
                  onSave={updateField('notes')}
                  multiline
                  placeholder="לחץ להוספת הערות"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <FollowUpHistoryFeed activities={activities} />
          <Card className="bg-white border-slate-200 shadow-xl shadow-slate-200/60 rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-lg">היסטוריית פעילות</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 h-64 overflow-y-auto">
              {activities.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">אין פעילויות שתועדו</div>
              ) : (
                <div className="space-y-4">
                  {activities.map(act => (
                    <div key={act.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                      <div>
                        <div className="font-medium text-slate-800">{act.title}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{new Date(act.created_date).toLocaleString('he-IL')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}