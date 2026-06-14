import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, X, Clock, CheckCircle2, Check, Trash2, ChevronRight } from 'lucide-react';
import { normalizeLeadStatus } from '@/utils/leadDisplay';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_OPTIONS = [
  { value: 'נוצר קשר', label: '📞 נוצר קשר', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'נשלח פולו-אפ', label: '📩 נשלח פולו-אפ', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'נענה', label: '✅ נענה / מעוניין', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'נסגר בהצלחה', label: '🏆 נסגר בהצלחה', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'לא רלוונטי', label: '❌ לא מעוניין', color: 'bg-red-50 text-red-700 border-red-200' },
];

function getLeadStage(lead) {
  const days = Number(lead.auto_followup_interval_days || 0);
  if (days >= 7) return 'פולו-אפ שבוע';
  if (days >= 3) return 'פולו-אפ 3 ימים';
  if (days > 1) return `פולו-אפ ${days} ימים`;
  return 'פולו-אפ יומי';
}

function getDueDate(lead) {
  if (lead.auto_followup_next_send) return new Date(lead.auto_followup_next_send);
  if (lead.auto_followup_last_sent && lead.auto_followup_interval_days) {
    return new Date(new Date(lead.auto_followup_last_sent).getTime() + Number(lead.auto_followup_interval_days) * MS_PER_DAY);
  }
  if (lead.last_contact_date && lead.auto_followup_interval_days) {
    return new Date(new Date(lead.last_contact_date).getTime() + Number(lead.auto_followup_interval_days) * MS_PER_DAY);
  }
  return null;
}

function getWhatsAppLink(lead) {
  const cleanPhone = String(lead.phone || '').replace(/[^0-9]/g, '');
  const phone = cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
  const text = lead.auto_followup_message || (lead.name ? `היי ${lead.name}, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לענות על כל שאלה מחכה לשמוע ממך! 📸` : 'היי, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לענות על כל שאלה מחכה לשמוע ממך! 📸');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function isDueLead(lead) {
  const status = normalizeLeadStatus(lead.status);
  // These statuses = done, remove from list
  if (['נסגר בהצלחה', 'לא רלוונטי', 'נענה'].includes(status)) return false;
  const cleanPhone = String(lead.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7) return false;

  const now = new Date();
  const dueDate = getDueDate(lead);

  // If next_send is in the future, NOT due (already marked sent recently)
  if (dueDate && dueDate > now) return false;

  const lastContact = lead.last_contact_date ? new Date(lead.last_contact_date) : new Date(lead.created_date || 0);
  const threeDaysWithoutResponse = lastContact && now - lastContact.getTime() >= 3 * MS_PER_DAY;

  return (dueDate && dueDate <= now) || threeDaysWithoutResponse;
}

// Status update dialog
function StatusUpdateDialog({ lead, onClose, onUpdate }) {
  const [saving, setSaving] = React.useState(false);

  const handleSelect = async (status) => {
    setSaving(true);
    await onUpdate(lead, status);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[95] flex items-end md:items-center justify-center" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-black text-slate-900">{lead.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">מה הסטטוס עכשיו?</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={saving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${opt.color}`}
            >
              <span>{opt.label}</span>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          ))}
        </div>
        <div className="p-3 pt-0">
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold">
            השאר כרגיל
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FollowUpNotificationBell({ user, isAdmin = false }) {
  const [open, setOpen] = React.useState(false);
  const [showTodayAlert, setShowTodayAlert] = React.useState(false);
  const [statusDialogLead, setStatusDialogLead] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ['followUpNotifications', user?.email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Lead.list('-updated_date', 500)
      : base44.entities.Lead.filter({ created_by: user.email }, '-updated_date', 300),
    enabled: !!user,
    refetchInterval: 1000 * 60 * 5,
  });

  const dueLeads = React.useMemo(() => leads.filter(isDueLead), [leads]);

  React.useEffect(() => {
    if (dueLeads.length > 0 && !sessionStorage.getItem('followup_today_alert_seen')) {
      setShowTodayAlert(true);
      sessionStorage.setItem('followup_today_alert_seen', 'true');
    }
  }, [dueLeads.length]);

  const markSentMutation = useMutation({
    mutationFn: (lead) => {
      const now = new Date();
      // Push next_send far into the future so it leaves the due list immediately
      const nextDate = new Date(now.getTime() + Number(lead.auto_followup_interval_days || 3) * MS_PER_DAY);
      return base44.entities.Lead.update(lead.id, {
        auto_followup_last_sent: now.toISOString(),
        auto_followup_next_send: nextDate.toISOString(),
        auto_followup_attempts_sent: Number(lead.auto_followup_attempts_sent || 0) + 1,
        last_contact_date: now.toISOString(),
        status: 'נשלח פולו-אפ',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followUpNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ lead, status }) => {
      const now = new Date();
      const nextDate = new Date(now.getTime() + Number(lead.auto_followup_interval_days || 3) * MS_PER_DAY);
      return base44.entities.Lead.update(lead.id, {
        status,
        last_contact_date: now.toISOString(),
        auto_followup_last_sent: now.toISOString(),
        auto_followup_next_send: nextDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followUpNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (lead) => {
      const now = new Date();
      const nextDate = new Date(now.getTime() + 3 * MS_PER_DAY);
      return base44.entities.Lead.update(lead.id, {
        auto_followup_next_send: nextDate.toISOString(),
        last_contact_date: now.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followUpNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleSend = (lead) => {
    markSentMutation.mutate(lead);
    window.open(getWhatsAppLink(lead), '_blank');
    setStatusDialogLead(lead);
  };

  const handleMarkSent = (lead) => {
    markSentMutation.mutate(lead);
    setStatusDialogLead(lead);
  };

  const handleDismiss = (lead) => {
    dismissMutation.mutate(lead);
  };

  const handleStatusUpdate = async (lead, status) => {
    await updateStatusMutation.mutateAsync({ lead, status });
  };

  if (!user) return null;

  const LeadCard = ({ lead, compact = false }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-900 truncate">{lead.name}</p>
          <p className="text-xs text-slate-500 mt-0.5" dir="ltr">{lead.phone}</p>
          <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
            <Clock className="w-3 h-3" />
            {getLeadStage(lead)}
          </div>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          <button
            onClick={() => handleSend(lead)}
            className="inline-flex items-center gap-1 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white px-2.5 py-1.5 text-xs font-black active:scale-95 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            onClick={() => handleMarkSent(lead)}
            className="inline-flex items-center gap-1 rounded-xl bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 text-xs font-black active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            נשלח ✓
          </button>
          <button
            onClick={() => handleDismiss(lead)}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 px-2.5 py-1.5 text-xs font-semibold active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            דחה
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((value) => !value)}
          className="relative w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white text-slate-900 border border-slate-200 shadow-none md:shadow-lg flex items-center justify-center transition-all active:scale-95"
          title="התראות פולו-אפ"
        >
          <Bell className="w-5 h-5" />
          {dueLeads.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center ring-2 ring-black md:ring-white">
              {dueLeads.length}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 bg-black/20 z-[70] md:hidden" onClick={() => setOpen(false)} />
            <div className="fixed left-3 right-3 top-20 bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-auto md:absolute md:left-0 md:right-auto md:top-auto md:mt-3 md:w-[420px] md:max-h-[70vh] rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-[80] flex flex-col" dir="rtl">
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">משימות פולו-אפ להיום</h3>
                  <p className="text-xs text-slate-500 mt-0.5">לידים שממתינים לפעולה</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth [-webkit-overflow-scrolling:touch] p-3 space-y-2 flex-1 min-h-0">
                {dueLeads.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    אין פולו-אפים פתוחים להיום
                  </div>
                ) : dueLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {showTodayAlert && dueLeads.length > 0 && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-start md:items-center justify-center p-3 pt-20 pb-[calc(88px+env(safe-area-inset-bottom))] md:p-4" dir="rtl">
          <div className="w-full max-w-lg max-h-full rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 bg-gradient-to-l from-[#FFD700] to-[#F6C400] text-black flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">משימות להיום</h2>
                <p className="font-bold mt-1">יש לך {dueLeads.length} לידים שמחכים לפולו-אפ היום!</p>
              </div>
              <button onClick={() => setShowTodayAlert(false)} className="w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth [-webkit-overflow-scrolling:touch] flex-1 min-h-0">
              {dueLeads.slice(0, 5).map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => { setShowTodayAlert(false); setOpen(true); }} className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm font-black">
                פתח התראות
              </button>
              <button onClick={() => setShowTodayAlert(false)} className="flex-1 rounded-xl bg-slate-100 text-slate-700 py-3 text-sm font-black">
                מאוחר יותר
              </button>
            </div>
          </div>
        </div>
      )}

      {statusDialogLead && (
        <StatusUpdateDialog
          lead={statusDialogLead}
          onClose={() => setStatusDialogLead(null)}
          onUpdate={handleStatusUpdate}
        />
      )}
    </>
  );
}