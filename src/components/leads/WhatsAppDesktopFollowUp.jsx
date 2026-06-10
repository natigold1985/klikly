import React, { useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const buildWhatsAppLink = (lead) => {
  const cleanPhone = String(lead?.phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;
  const phone = cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
  const name = lead?.name && !['לא ידוע', 'unknown'].includes(String(lead.name).toLowerCase()) ? ` ${lead.name}` : '';
  const text = lead?.auto_followup_message || `היי${name}, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לענות על כל שאלה, מחכה לשמוע ממך! 📸`;
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
};

export default function WhatsAppDesktopFollowUp({ lead, onDone }) {
  const queryClient = useQueryClient();
  const linkRef = useRef(null);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      await base44.entities.Lead.update(lead.id, {
        status: 'נשלח פולו-אפ',
        last_contact_date: now,
        auto_followup_last_sent: now,
        auto_followup_attempts_sent: Number(lead.auto_followup_attempts_sent || 0) + 1,
      });
      await base44.entities.Activity.create({
        related_to_type: 'lead',
        related_to_id: lead.id,
        activity_type: 'call_made',
        title: 'נשלח פולו-אפ ב-WhatsApp',
        description: 'הודעת פולו-אפ נפתחה לשליחה ב-WhatsApp Web',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] });
      onDone?.();
      toast.success('הפולו-אפ סומן כנשלח');
    },
  });

  const whatsappUrl = buildWhatsAppLink(lead);

  if (!whatsappUrl) return null;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            פולו-אפ מהיר ב-WhatsApp Desktop
          </h3>
          <p className="text-sm text-slate-600 mt-1">פותח הודעה מוכנה ומעדכן את סטטוס הליד.</p>
        </div>
        {/* hidden anchor — clicked programmatically to bypass popup blockers */}
        <a ref={linkRef} href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hidden">open</a>
        <button
          onClick={() => { linkRef.current?.click(); sendMutation.mutate(); }}
          disabled={sendMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-sm transition-colors disabled:opacity-60"
        >
          <MessageCircle className="w-4 h-4" />
          שלח פולו-אפ
        </button>
      </div>
    </div>
  );
}