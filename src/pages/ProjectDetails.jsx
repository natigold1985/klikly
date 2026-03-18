import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowRight, Phone, Mail, Calendar, MapPin, 
  DollarSign, CheckCircle2, ListTodo, Download, Eye, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProjectDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const isClient = user?.role === 'client';

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId,
  });

  if (isLoading) return <div className="p-8 text-center">טוען...</div>;
  if (!project) return <div className="p-8 text-center">פרויקט לא נמצא</div>;

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_payment: { label: 'ממתין לתשלום', color: 'bg-yellow-100 text-yellow-700' },
      paid: { label: 'שולם', color: 'bg-green-100 text-green-700' },
      shooting_scheduled: { label: 'צילום מתוכנן', color: 'bg-blue-100 text-blue-700' },
      shooting_done: { label: 'צילום בוצע', color: 'bg-indigo-100 text-indigo-700' },
      awaiting_selection: { label: 'ממתין לבחירת לקוח', color: 'bg-purple-100 text-purple-700' },
      editing: { label: 'בעריכה', color: 'bg-orange-100 text-orange-700' },
      ready_for_download: { label: 'מוכן להורדה', color: 'bg-cyan-100 text-cyan-700' },
      completed: { label: 'הושלם', color: 'bg-gray-100 text-gray-700' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    return <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{project.client_name} - {project.shooting_type}</h1>
        </div>
        {getStatusBadge(project.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>פרטי הפרויקט</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">שם הלקוח</label>
                  <div className="font-medium">{project.client_name}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">טלפון</label>
                  <div className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {project.client_phone || 'לא הוזן'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">אימייל</label>
                  <div className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {project.client_email || 'לא הוזן'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תאריך צילום</label>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {project.shooting_date ? new Date(project.shooting_date).toLocaleDateString('he-IL') : 'לא נקבע'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">מיקום</label>
                  <div className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {project.shooting_location || 'לא צוין'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">מחיר</label>
                  <div className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    {project.total_price ? `₪${project.total_price.toLocaleString()}` : 'לא צוין'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>סטטוס קבצים</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 md:gap-8 justify-around">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{project.raw_photos_count || 0}</div>
                  <div className="text-xs text-slate-500">גולמיות</div>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{project.selected_photos_count || 0}</div>
                  <div className="text-xs text-slate-500">נבחרו ע"י לקוח</div>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{project.final_photos_count || 0}</div>
                  <div className="text-xs text-slate-500">ערוכות ומוכנות</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Link to={createPageUrl(`ProjectTasks?projectId=${project.id}`)} className="block">
            <Card className="bg-indigo-50 border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4 text-indigo-700">
                <div className="p-2 bg-indigo-200 rounded-lg">
                  <ListTodo className="w-6 h-6 text-indigo-800" />
                </div>
                <div className="font-semibold text-lg">ניהול משימות</div>
              </CardContent>
            </Card>
          </Link>
          
          <Link to={createPageUrl(`FileStorage?projectId=${project.id}`)} className="block">
            <Card className="bg-slate-50 border-slate-200 hover:bg-slate-100 transition-colors shadow-sm cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4 text-slate-700">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <Upload className="w-6 h-6 text-slate-800" />
                </div>
                <div className="font-semibold text-lg">ניהול קבצים</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}