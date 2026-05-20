import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, X, Clock, CheckCircle2 } from 'lucide-react';
import { normalizeLeadStatus } from '@/utils/leadDisplay';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

function isDueLead(lead) {
  const status = normalizeLeadStatus(lead.status);
  if (['נסגר בהצלחה', 'לא רלוונטי', 'נענה'].includes(status)) return false;
  const cleanPhone = String(lead.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7) return false;
  const dueDate = getDueDate(lead);
  const lastContact = lead.last_contact_date ? new Date(lead.last_contact_date) : new Date(lead.created_date || 0);
  const threeDaysWithoutResponse = lastContact && Date.now() - lastContact.getTime() >= 3 * MS_PER_DAY;
  return (dueDate && dueDate <= new Date()) || status === 'נשלח פולו-אפ' || threeDaysWithoutResponse;
}

export default function FollowUpNotificationBell({ user, isAdmin = false }) {
  const [open, setOpen] = React.useState(false);
  const [showTodayAlert, setShowTodayAlert] = React.useState(false);
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

  const markDoneMutation = useMutation({
    mutationFn: (lead) => {
      const now = new Date();
      const nextDate = new Date(now.getTime() + Number(lead.auto_followup_interval_days || 1) * MS_PER_DAY);
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

  const handleSend = (lead) => {
    markDoneMutation.mutate(lead);
    window.location.href = getWhatsAppLink(lead);
  };

  if (!user) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((value) => !value)}
          className="relative w-11 h-11 rounded-2xl bg-white/95 text-slate-900 border border-slate-200 shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-95"
          title="התראות פולו-אפ"
        >
          <Bell className="w-5 h-5" />
          {dueLeads.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white">
              {dueLeads.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute left-0 mt-3 w-[min(92vw,420px)] rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-[80]" dir="rtl">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">משימות פולו-אפ להיום</h3>
                <p className="text-xs text-slate-500 mt-0.5">לידים שממתינים לפעולה</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
              {dueLeads.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  אין פולו-אפים פתוחים להיום
                </div>
              ) : dueLeads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">{lead.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5" dir="ltr">{lead.phone}</p>
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                        <Clock className="w-3.5 h-3.5" />
                        {getLeadStage(lead)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSend(lead)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-2 text-xs font-black shadow-sm active:scale-95 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTodayAlert && dueLeads.length > 0 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-start md:items-center justify-center p-4 pt-24" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-l from-[#FFD700] to-[#F6C400] text-black flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">משימות להיום</h2>
                <p className="font-bold mt-1">יש לך {dueLeads.length} לידים שמחכים לפולו-אפ היום!</p>
              </div>
              <button onClick={() => setShowTodayAlert(false)} className="w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
              {dueLeads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-500">{getLeadStage(lead)} · <span dir="ltr">{lead.phone}</span></p>
                  </div>
                  <button onClick={() => handleSend(lead)} className="shrink-0 rounded-xl bg-[#25D366] text-white px-3 py-2 text-xs font-black">
                    שלח WhatsApp
                  </button>
                </div>
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
    </>
  );
}