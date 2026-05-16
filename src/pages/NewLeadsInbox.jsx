import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import LeadCard from '@/components/crm/LeadCard';

export default function NewLeadsInbox() {
  const queryClient = useQueryClient();
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list('-created_date', 300) });
  const { data: attachments = [] } = useQuery({ queryKey: ['attachments'], queryFn: () => base44.entities.Attachment.list('-created_date', 500) });

  const updateLead = useMutation({ mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }) });
  const createTask = useMutation({ mutationFn: (data) => base44.entities.Task.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }) });

  const newLeads = leads.filter((lead) => lead.status === 'new');

  const handleWhatsApp = (lead) => {
    const followUp = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    updateLead.mutate({ id: lead.id, data: { status: 'in_progress', last_contact_date: new Date().toISOString(), next_follow_up_date: followUp } });
    createTask.mutate({ related_to_type: 'lead', related_to_id: lead.id, title: `Follow up with ${lead.name}`, due_date: followUp, status: 'pending', priority: 'high' });
    window.open(`https://wa.me/${String(lead.phone || '').replace(/[^0-9]/g, '')}`, '_blank');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Inbox className="w-8 h-8 text-[#C5A028]" />New Leads Inbox</h1>
        <p className="text-slate-500 text-sm mt-1">רק לידים חדשים שטרם טופלו</p>
      </div>
      {newLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-slate-400">אין לידים חדשים כרגע</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {newLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              attachments={attachments.filter((file) => file.related_to_type === 'lead' && file.related_to_id === lead.id)}
              onWhatsApp={handleWhatsApp}
              onAttachmentsChanged={() => queryClient.invalidateQueries({ queryKey: ['attachments'] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}