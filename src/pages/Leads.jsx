import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KanbanSquare, Bell } from 'lucide-react';
import LeadCard from '@/components/crm/LeadCard';

const COLUMNS = [
  { key: 'new', label: 'New Lead' },
  { key: 'in_progress', label: 'Contacted' },
  { key: 'follow_up', label: 'Follow-up Required' },
  { key: 'closed_won', label: 'Closed Won' },
  { key: 'closed_lost', label: 'Closed Lost' },
];

export default function Leads() {
  const queryClient = useQueryClient();
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list('-created_date', 500) });
  const { data: attachments = [] } = useQuery({ queryKey: ['attachments'], queryFn: () => base44.entities.Attachment.list('-created_date', 500) });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list('-due_date', 200) });

  const updateLead = useMutation({ mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }) });
  const createProject = useMutation({ mutationFn: (data) => base44.entities.Project.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }) });
  const createTask = useMutation({ mutationFn: (data) => base44.entities.Task.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }) });

  const moveLead = async (lead, status) => {
    await updateLead.mutateAsync({ id: lead.id, data: { status } });
    if (status === 'closed_won') {
      await createProject.mutateAsync({
        lead_id: lead.id,
        project_name: lead.name,
        client_name: lead.name,
        client_email: lead.email || `${String(lead.phone || '').replace(/[^0-9]/g, '')}@client.local`,
        client_phone: lead.phone,
        shooting_type: lead.shooting_type || lead.notes || 'CRM Project',
        status: 'paid',
        payment_status: 'pending',
      });
    }
  };

  const handleDrop = (event, status) => {
    const leadId = event.dataTransfer.getData('leadId');
    const lead = leads.find((item) => item.id === leadId);
    if (lead) moveLead(lead, status);
  };

  const handleWhatsApp = (lead) => {
    const followUp = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    updateLead.mutate({ id: lead.id, data: { status: 'in_progress', last_contact_date: new Date().toISOString(), next_follow_up_date: followUp } });
    createTask.mutate({ related_to_type: 'lead', related_to_id: lead.id, title: `Follow up with ${lead.name}`, due_date: followUp, status: 'pending', priority: 'high' });
    window.open(`https://wa.me/${String(lead.phone || '').replace(/[^0-9]/g, '')}`, '_blank');
  };

  const today = new Date().toISOString().slice(0, 10);
  const dueToday = tasks.filter((task) => task.status !== 'completed' && task.due_date?.slice(0, 10) <= today);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><KanbanSquare className="w-8 h-8 text-[#C5A028]" />Dashboard (Kanban)</h1>
          <p className="text-slate-500 text-sm mt-1">גרור לידים בין שלבים, שלח WhatsApp, וסגור פרויקט בלחיצה.</p>
        </div>
        {dueToday.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {dueToday.length} Tasks/Reminders להיום
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => (lead.status || 'new') === column.key);
          return (
            <div key={column.key} onDrop={(event) => handleDrop(event, column.key)} onDragOver={(event) => event.preventDefault()} className="rounded-2xl bg-slate-50 border border-slate-200 p-3 min-h-96">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-slate-800 text-sm">{column.label}</h2>
                <span className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5">{columnLeads.length}</span>
              </div>
              <div className="space-y-3">
                {columnLeads.map((lead) => (
                  <div key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData('leadId', lead.id)}>
                    <LeadCard
                      lead={lead}
                      attachments={attachments.filter((file) => file.related_to_type === 'lead' && file.related_to_id === lead.id)}
                      onWhatsApp={handleWhatsApp}
                      onAttachmentsChanged={() => queryClient.invalidateQueries({ queryKey: ['attachments'] })}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}