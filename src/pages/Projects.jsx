import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, Search, Briefcase, Upload, Download, Eye, CheckCircle2, 
  Smartphone, ExternalLink, RefreshCw, ListTodo, MessageCircle, Trash2
} from 'lucide-react';
import DeliveryLinkButton from '../components/DeliveryLinkButton';
import FileUploader from '../components/FileUploader';
import AttachmentUploader from '@/components/crm/AttachmentUploader';
import ProductionStatusTracker from '../components/projects/ProductionStatusTracker';
import CreateProjectDialog from '../components/projects/CreateProjectDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadProject, setUploadProject] = useState(null);
  const [showMagicLinkPrompt, setShowMagicLinkPrompt] = useState(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isClient = user?.role === 'client';

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter, user?.email],
    queryFn: () => {
      if (isClient) {
        return base44.entities.Project.filter({ client_email: user.email }, '-created_date', 200);
      }
      return base44.entities.Project.filter({ created_by: user.email }, '-created_date', 200);
    },
    enabled: !!user,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments'],
    queryFn: () => base44.entities.Attachment.list('-created_date', 500),
    enabled: !!user,
  });

  const handleUploadComplete = async (uploadedFiles) => {
    if (uploadProject && uploadedFiles && uploadedFiles.length > 0) {
      try {
        const photoPromises = uploadedFiles.map(file => 
          base44.entities.Photo.create({
            project_id: uploadProject.id,
            type: 'raw',
            file_url: file.file_url,
            file_name: file.file_name,
            file_size: file.file_size
          })
        );
        await Promise.all(photoPromises);
        
        await base44.entities.Project.update(uploadProject.id, {
          raw_photos_count: (uploadProject.raw_photos_count || 0) + uploadedFiles.length
        });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } catch (err) {
        console.error("Error creating photo records", err);
      }
    }

    toast.success("הקבצים הועלו בהצלחה והתווספו לפרויקט");
    // Show magic link prompt after slight delay
    if (uploadProject) {
      setTimeout(() => {
        setUploadProject(null);
        setShowMagicLinkPrompt(uploadProject);
      }, 1000);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = 
      (project.project_name && project.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      project.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.client_email && project.client_email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_payment: { label: 'ממתין לתשלום', color: 'bg-yellow-500' },
      paid: { label: 'שולם', color: 'bg-green-500' },
      shooting_scheduled: { label: 'צילום מתוכנן', color: 'bg-blue-500' },
      shooting_done: { label: 'צילום בוצע', color: 'bg-indigo-500' },
      awaiting_selection: { label: 'ממתין לבחירת לקוח', color: 'bg-purple-500' },
      editing: { label: 'בעריכה', color: 'bg-orange-500' },
      ready_for_download: { label: 'מוכן להורדה', color: 'bg-cyan-500' },
      completed: { label: 'הושלם', color: 'bg-gray-500' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-500' };
    return <Badge className={`${badge.color} text-white`}>{badge.label}</Badge>;
  };

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId) => base44.entities.Project.delete(projectId),
    onSuccess: () => {
      toast.success('הפרויקט נמחק');
      setProjectToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
    },
  });

  const getStatusIcon = (status) => {
    if (status === 'awaiting_selection') return <Eye className="w-5 h-5 text-[#FFD700]" />;
    if (status === 'ready_for_download') return <Download className="w-5 h-5 text-[#FFD700]" />;
    if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <Briefcase className="w-5 h-5 text-[#FFD700]" />;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)] tracking-wider">
            פרויקטים
          </h1>
          <p className="text-slate-600 mt-1">נהל את כל הפרויקטים הפעילים שלך</p>
        </div>
        {!isClient && (
          <Button onClick={() => setShowCreateProject(true)} className="gap-2">
            <Plus className="w-5 h-5" />
            פרויקט חדש
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-white border-[#FFD700] shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי שם לקוח או אימייל..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="pending_payment">ממתין לתשלום</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="shooting_scheduled">צילום מתוכנן</SelectItem>
                <SelectItem value="shooting_done">צילום בוצע</SelectItem>
                <SelectItem value="awaiting_selection">ממתין לבחירת לקוח</SelectItem>
                <SelectItem value="editing">בעריכה</SelectItem>
                <SelectItem value="ready_for_download">מוכן להורדה</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="bg-white border-[#FFD700] shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl">
          <CardContent className="p-12 text-center">
            <Briefcase className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500">לא נמצאו פרויקטים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="bg-white border-slate-200 hover:border-[#FFD700] hover:shadow-[0_8px_30px_rgba(255,215,0,0.15)] transition-all duration-300 cursor-pointer group rounded-2xl">
              <CardContent className="p-6">
                <Link to={createPageUrl(`ProjectDetails?id=${project.id}`)} className="block hover:opacity-80">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 text-[#FFD700] flex items-center justify-center group-hover:bg-[#FFD700]/10 group-hover:border-[#FFD700] transition-colors">
                        {getStatusIcon(project.status)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-[#C5A028] transition-colors">
                          {project.project_name || project.client_name}
                        </h3>
                        <p className="text-sm text-slate-600">{project.client_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(project.status)}
                      {!isClient && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProjectToDelete(project);
                          }}
                          className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors"
                          title="מחיקת פרויקט"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {project.shooting_date && (
                      <div className="text-sm text-slate-600">
                        📅 {new Date(project.shooting_date).toLocaleDateString('he-IL')}
                      </div>
                    )}
                    {project.total_price && (
                      <div className="text-sm font-medium text-[#C5A028]">
                        ₪{project.total_price.toLocaleString()}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Production Status Tracker */}
                <div className="pt-4 border-t border-slate-200">
                  <ProductionStatusTracker status={project.status} />
                </div>

                <div className="pt-4">
                  <AttachmentUploader
                    relatedType="project"
                    relatedId={project.id}
                    clientName={project.client_name}
                    attachments={attachments.filter((file) => file.related_to_type === 'project' && file.related_to_id === project.id)}
                    onUploaded={() => queryClient.invalidateQueries({ queryKey: ['attachments'] })}
                  />
                </div>

                {!isClient && (
                  <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2">
                      <DeliveryLinkButton project={project} />
                      <Link to={createPageUrl(`ProjectTasks?projectId=${project.id}`)} onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="sm" className="text-xs gap-1 bg-slate-800 text-slate-300 hover:bg-slate-700 border-none">
                          <ListTodo className="w-3 h-3" />
                          משימות
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs gap-1 border-dashed border-slate-700 bg-transparent text-slate-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadProject(project);
                        }}
                      >
                        <Smartphone className="w-3 h-3" />
                        מהנייד
                      </Button>
                    </div>
                    <Button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        toast.loading("מייצר הודעה...", { id: `wa-${project.id}` });
                        base44.functions.invoke('sendWhatsAppReminder', { 
                          type: project.payment_status !== 'paid' ? 'payment_reminder' : 'delivery_notification',
                          projectId: project.id
                        }).then((res) => {
                          toast.dismiss(`wa-${project.id}`);
                          window.open(res.data.waLink, '_blank');
                        }).catch((err) => toast.error("שגיאה: " + err.message, { id: `wa-${project.id}` }));
                      }}
                      className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-[#25D366]/20 px-3 py-1.5 h-8 transition-all duration-300 font-medium rounded-full text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="font-bold">{project.payment_status !== 'paid' ? 'תזכורת תשלום' : 'הודעת משלוח'}</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
        }}
      />

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>למחוק את הפרויקט?</DialogTitle>
            <DialogDescription>
              הפעולה תמחק את הפרויקט "{projectToDelete?.project_name || projectToDelete?.client_name}" מהמערכת. אי אפשר לבטל את הפעולה.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProjectToDelete(null)} className="text-slate-900 border-slate-300">ביטול</Button>
            <Button
              onClick={() => deleteProjectMutation.mutate(projectToDelete.id)}
              disabled={deleteProjectMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white shadow-none"
            >
              {deleteProjectMutation.isPending ? 'מוחק...' : 'כן, מחק'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Upload Dialog */}
      <Dialog open={!!uploadProject} onOpenChange={(open) => !open && setUploadProject(null)}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>העלאת חומרים מהנייד</DialogTitle>
            <DialogDescription>
              בחר קבצים מהגלריה להעלאה לפרויקט של {uploadProject?.client_name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <FileUploader 
              onUploadComplete={handleUploadComplete} 
              projectId={uploadProject?.id}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Magic Link Prompt Dialog */}
      <Dialog open={!!showMagicLinkPrompt} onOpenChange={(open) => !open && setShowMagicLinkPrompt(null)}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הקבצים הועלו בהצלחה!</DialogTitle>
            <DialogDescription>
              האם ברצונך לייצר לינק הורדה (Magic Link) ללקוח עכשיו?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowMagicLinkPrompt(null)}>לא כרגע</Button>
            <DeliveryLinkButton project={showMagicLinkPrompt} label="כן, צור לינק" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}