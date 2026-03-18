import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Phone, Mail, Calendar, Edit, 
  Trash2, Briefcase, Plus, CheckCircle2, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LeadDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      toast.success("פרטי הליד עודכנו");
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: (newProject) => {
      // Also update lead status to closed_won
      updateLeadMutation.mutate({ status: 'closed_won' });
      toast.success("פרויקט חדש נוצר בהצלחה!");
      navigate(`/ProjectDetails?id=${newProject.id}`);
    }
  });

  if (isLoading) return <div className="p-8 text-center">טוען...</div>;
  if (!lead) return <div className="p-8 text-center">ליד לא נמצא</div>;

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
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">תיק ליד</h1>
        </div>
        {lead.status !== 'closed_won' && (
          <Button onClick={convertToProject} className="bg-green-600 hover:bg-green-700 text-white shadow-md">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            הפוך ללקוח (פרויקט)
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>פרטי איש קשר</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">שם מלא</label>
                  <div className="font-medium">{lead.name}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">טלפון</label>
                  <div className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {lead.phone}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">אימייל</label>
                  <div className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {lead.email || 'לא הוזן'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">סוג צילום</label>
                  <div className="font-medium">{lead.shooting_type || 'לא הוגדר'}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תאריך אירוע</label>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {lead.event_date ? new Date(lead.event_date).toLocaleDateString('he-IL') : 'לא נקבע'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תקציב משוער</label>
                  <div className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    {lead.budget ? `₪${lead.budget.toLocaleString()}` : 'לא צוין'}
                  </div>
                </div>
              </div>
              
              {lead.notes && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <label className="text-sm text-slate-500 block mb-2">הערות</label>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
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