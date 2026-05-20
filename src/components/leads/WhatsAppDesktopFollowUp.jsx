import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const buildWhatsAppDesktopLink = (lead) => {
  const cleanPhone = String(lead?.phone || '').replace(/[^0-9]/g, '');
  const phone = cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
  const name = lead?.name && !['לא ידוע', 'unknown'].includes(String(lead.name).toLowerCase()) ? ` ${lead.name}` : '';
  const text = lead?.auto_followup_message || `היי${name}, רציתי לבדוק אם קיבלת את הפרטים ששלחתי. אשמח לענות על כל שאלה, מחכה לשמוע ממך! 📸`;
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
};

export default function WhatsAppDesktopFollowUp({ lead, onDone }) {
  const queryClient = useQueryClient();

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
        description: 'הודעת פולו-אפ נפתחה לשליחה ב-WhatsApp Desktop',
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

  const handleSend = () => {
    if (!lead?.phone) {
      toast.error('אין מספר טלפון לליד הזה');
      return;
    }
    sendMutation.mutate();
    window.location.href = buildWhatsAppDesktopLink(lead);
  };

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
        <Button onClick={handleSend} disabled={sendMutation.isPending} className="bg-[#25D366] hover:bg-[#128C7E] text-white">
          <CheckCircle2 className="w-4 h-4" />
          שלח פולו-אפ
        </Button>
      </div>
    </div>
  );
}