import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowRight, Phone, Mail, Calendar, MapPin, 
  DollarSign, CheckCircle2, ListTodo, Download, Eye, Upload,
  Link as LinkIcon, Copy, Lock, RefreshCw, FolderPlus, ExternalLink, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ProjectDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const isClient = user?.role === 'client';
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('עודכן בהצלחה');
    },
    onError: () => toast.error('שגיאה בעדכון הפרויקט')
  });

  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    updateProjectMutation.mutate({ gallery_pin: newPin });
  };

  const handleCopyGalleryLink = () => {
    const url = `${window.location.origin}/gallery/${projectId}${project.gallery_pin ? `?pin=${project.gallery_pin}` : ''}`;
    navigator.clipboard.writeText(url);
    toast.success('קישור לגלריה הועתק');
  };

  const [creatingFolder, setCreatingFolder] = useState(false);
  const handleCreateDriveFolder = async () => {
    setCreatingFolder(true);
    const res = await base44.functions.invoke('createDriveFolder', { project_id: projectId });
    if (res.data?.success) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('תיקיית Drive נוצרה בהצלחה!');
    } else {
      toast.error(res.data?.error || 'שגיאה ביצירת התיקייה');
    }
    setCreatingFolder(false);
  };

  if (isLoading) return <div className="p-8 text-center text-white/50">טוען...</div>;
  if (!project) return <div className="p-8 text-center text-white/50">פרויקט לא נמצא</div>;

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
            <Card className="bg-[#0a0a0a] border-white/10 hover:border-[#FFD700]/30 hover:bg-white/5 transition-all shadow-xl cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4 text-white">
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg text-[#FFD700]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-semibold text-lg">ניהול קבצים</div>
              </CardContent>
            </Card>
          </Link>

          {/* Google Drive Folder */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FolderPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="font-semibold text-slate-800">Google Drive</div>
              </div>
              {project.drive_folder_url ? (
                <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  <ExternalLink className="w-4 h-4" />
                  פתח תיקיית Drive
                </a>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCreateDriveFolder} disabled={creatingFolder}>
                  {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  צור תיקייה ב-Drive
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Client Gallery Access Card */}
          <Card className="bg-[#0a0a0a] border-white/10 shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-[#FFD700]/10 to-transparent border-b border-white/10 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#FFD700]">
                <Eye className="w-5 h-5" />
                גלריית לקוח פרטית
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <label className="text-sm text-white/50 mb-1.5 block">קוד גישה (PIN)</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-lg flex items-center">
                    {project.gallery_pin || 'לא הוגדר'}
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleGeneratePin}
                    className="border-white/20 hover:bg-white/10 px-3"
                    title="רענן קוד"
                  >
                    <RefreshCw className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </div>
              <Button 
                onClick={handleCopyGalleryLink}
                className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_4px_14px_rgba(255,215,0,0.25)] flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                העתק קישור ללקוח
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}