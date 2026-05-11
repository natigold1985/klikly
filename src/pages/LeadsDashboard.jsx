import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LeadsKanban from '@/components/whatsappLeads/LeadsKanban';
import LeadEditDialog from '@/components/whatsappLeads/LeadEditDialog';
import CsvImportButton from '@/components/whatsappLeads/CsvImportButton';

export default function LeadsDashboard() {
  const [selectedLead, setSelectedLead] = useState(null);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['whatsappLeads'],
    queryFn: () => base44.entities.Leads.list('-created_at', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Leads.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsappLeads'] });
      setSelectedLead(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (items) => base44.entities.Leads.bulkCreate(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsappLeads'] }),
  });

  return (
    <div className="min-h-screen bg-white text-slate-900" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-emerald-700" />
            </div>
            <h1 className="text-3xl font-black">Leads Dashboard</h1>
          </div>
          <p className="text-slate-500">ניהול לידים נכנסים מוואטסאפ ומקבצי CSV.</p>
        </div>
        <CsvImportButton onImport={(items) => importMutation.mutate(items)} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6 text-sm text-slate-700">
        <p className="font-bold mb-1">Webhook ל-JONI:</p>
        <p>POST לפונקציה <span className="font-mono">whatsappLeadsWebhook</span> עם JSON: <span className="font-mono">{"{ \"phone\": \"...\", \"first_name\": \"...\", \"full_name\": \"...\", \"source\": \"Photography Course\" }"}</span></p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : (
        <LeadsKanban leads={leads} onLeadClick={setSelectedLead} />
      )}

      <LeadEditDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
      />
    </div>
  );
}