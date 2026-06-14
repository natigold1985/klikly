import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowRight, FolderOpen, Plus, UserPlus } from 'lucide-react';
import PixiesetGallery from '../components/storage/PixiesetGallery';
import PhotographerDisclaimer from '../components/storage/PhotographerDisclaimer';
import DriveProjectView from '../components/storage/DriveProjectView';
import GoogleDriveIcon from '../components/storage/GoogleDriveIcon';
import CreateProjectDialog from '../components/projects/CreateProjectDialog';
import ProjectStorageCard from '../components/storage/ProjectStorageCard';
import AddUserDialog from '../components/admin/AddUserDialog';

export default function FileStorage() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [search, setSearch] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isClient = user?.role === 'client';

  // === CLIENT VIEW: their own gallery (legacy, edited photos) ===
  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['clientPhotos', user?.email],
    queryFn: async () => {
      const directPhotos = await base44.entities.Photo.filter({ client_email: user.email, type: 'edited' }, '-created_date', 500);
      const allProjects = await base44.entities.Project.list('-created_date', 200);
      const matchingProjects = allProjects.filter((p) => {
        const emails = Array.isArray(p.client_emails) ? p.client_emails : [];
        return [p.client_email, ...emails].filter(Boolean).some((email) => email.toLowerCase() === user.email.toLowerCase());
      });
      if (!matchingProjects.length) return directPhotos;
      const projectPhotos = (await Promise.all(
        matchingProjects.map((p) => base44.entities.Photo.filter({ project_id: p.id, type: 'edited' }, '-created_date', 500))
      )).flat();
      return [...directPhotos, ...projectPhotos].filter((photo, index, arr) => arr.findIndex((p) => p.id === photo.id) === index);
    },
    enabled: !!user && isClient,
  });

  // === PHOTOGRAPHER VIEW: list of projects (each = one Drive folder) ===
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['driveProjects'],
    queryFn: () => base44.entities.Project.list('-created_date', 200),
    enabled: !!user && !isClient,
  });

  useEffect(() => {
    if (!projects.length || selectedProject) return;
    const params = new URLSearchParams(window.location.search);
    const clientEmail = params.get('client_email');
    const projectId = params.get('project_id');
    if (!clientEmail && !projectId) return;

    const match = projects.find((p) =>
      (projectId && p.id === projectId) ||
      (clientEmail && [p.client_email, ...(Array.isArray(p.client_emails) ? p.client_emails : [])].filter(Boolean).some((email) => email.toLowerCase() === clientEmail.toLowerCase()))
    );

    if (match) {
      setSelectedProject(match);
      setSearch(match.client_email || match.client_name || '');
    } else if (clientEmail) {
      setSearch(clientEmail);
    }
  }, [projects, selectedProject]);

  const handleClientDownload = (photo) => {
    base44.functions.invoke('onClientFirstDownload', { file_name: photo.file_name }).catch(() => {});
    window.open(photo.file_url, '_blank');
  };

  // ========== CLIENT VIEW ==========
  if (isClient) {
    return (
      <div className="space-y-6 pb-20" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">הגלריה שלי</h1>
          <p className="text-slate-600 text-sm">
            לחץ על תמונה לצפייה במסך מלא · הקבצים זמינים להורדה למשך 90 יום מההורדה הראשונה
          </p>
        </div>
        <PixiesetGallery photos={photos} loading={loadingPhotos} canDelete={false} onDownload={handleClientDownload} />
      </div>
    );
  }

  // ========== PHOTOGRAPHER: PROJECT DETAIL ==========
  if (selectedProject) {
    return (
      <div className="space-y-5 pb-20" dir="rtl">
        {/* Persistent Back Bar */}
        <div className="flex items-center justify-between gap-3 sticky top-0 md:top-0 z-20 bg-white/95 backdrop-blur-md py-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedProject(null);
              window.history.replaceState({}, '', '/FileStorage');
            }}
            className="gap-2 text-black border-[#FFD700] bg-[#FFD700] hover:bg-[#e6c200] shadow-lg font-extrabold px-5 h-11"
          >
            <ArrowRight className="w-4 h-4" />
            חזור לרשימת הפרויקטים
          </Button>
          <div className="text-left flex-1 min-w-0">
            <div className="text-[11px] text-slate-400 mb-0.5">אחסון קבצים / {selectedProject.client_name}</div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">
              {selectedProject.project_name || selectedProject.client_name}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {selectedProject.client_email || selectedProject.shooting_type}
            </p>
          </div>
        </div>

        <DriveProjectView
          project={selectedProject}
          onProjectDeleted={() => {
            setSelectedProject(null);
            window.history.replaceState({}, '', '/FileStorage');
          }}
        />
      </div>
    );
  }

  // ========== PHOTOGRAPHER: PROJECT LIST ==========
  const filtered = projects.filter(
    (p) =>
      !search ||
      p.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(p.client_emails) && p.client_emails.some((email) => email.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
            אחסון קבצים
          </h1>
          <p className="text-slate-600 text-sm flex items-center gap-1.5">
            <GoogleDriveIcon className="w-4 h-4" />
            מחובר ל-Google Drive · תיקייה ייחודית לכל פרויקט · גלריה ובחירת לקוח
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowAddClient(true)}
            variant="outline"
            className="gap-2 border-[#FFD700] text-[#b38f2d] bg-white hover:bg-amber-50 font-bold"
          >
            <UserPlus className="w-5 h-5" />
            הוסף לקוח
          </Button>
          <Button onClick={() => setShowCreateProject(true)} className="gap-2 bg-[#FFD700] text-black hover:bg-[#E5B800]">
            <Plus className="w-5 h-5" />
            פרויקט חדש
          </Button>
        </div>
      </div>

      <PhotographerDisclaimer />

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש פרויקט לפי שם או אימייל..."
          className="pr-10"
        />
      </div>

      {loadingProjects ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              {projects.length === 0 ? 'אין עדיין פרויקטים' : 'לא נמצאו פרויקטים'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {projects.length === 0 ? 'צור פרויקט מליד כדי להתחיל' : 'נסה חיפוש אחר'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectStorageCard key={p.id} project={p} onOpen={() => setSelectedProject(p)} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      <AddUserDialog
        open={showAddClient}
        onOpenChange={setShowAddClient}
        defaultRole="client"
        onCreated={() => {
          // Refresh client lists so the new client is available everywhere immediately.
          queryClient.invalidateQueries({ queryKey: ['projectClients'] });
          queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] });
        }}
      />
    </div>
  );
}