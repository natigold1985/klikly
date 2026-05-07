import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExternalLink, FolderOpen, RefreshCw, Cloud, Loader2, Link2, Upload, Trash2 } from 'lucide-react';
import DriveFilesGrid from './DriveFilesGrid';
import MagicLinkButton from './MagicLinkButton';
import DriveUploader from './DriveUploader';
import GoogleDriveIcon from './GoogleDriveIcon';
import LinkDriveFolderDialog from './LinkDriveFolderDialog';
import DriveFolderUrlEditor from './DriveFolderUrlEditor';
import DriveCreateFolderDialog from './DriveCreateFolderDialog';
import { toast } from 'sonner';

// Photographer view: pulls files directly from a project's Google Drive folder.
// Zero-cost — files stay in the photographer's Drive account.
export default function DriveProjectView({ project, onProjectDeleted }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Optimistic files appear immediately on upload (before refetch finishes)
  const [optimistic, setOptimistic] = useState([]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['driveFiles', project.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFiles', { project_id: project.id });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed');
      return res.data;
    },
    enabled: !!project.id && !!project.drive_folder_url,
  });

  const serverFiles = data?.files || [];
  // Merge optimistic on top, dedupe by id
  const files = [
    ...optimistic.filter((o) => !serverFiles.some((s) => s.id === o.id)),
    ...serverFiles,
  ];

  const handleCreateFolder = async () => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke('createDriveFolder', { project_id: project.id });
      if (res.status === 200) {
        toast.success('התיקייה נוצרה ב-Google Drive');
        // Refresh project + files
        queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
        queryClient.invalidateQueries({ queryKey: ['driveFiles', project.id] });
      } else {
        toast.error(res.data?.error || 'שגיאה ביצירת תיקייה');
      }
    } catch (e) {
      toast.error('שגיאה ביצירת תיקייה');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (file) => {
    window.open(file.download_url, '_blank');
  };

  const handleDownloadAll = (filesToDownload) => {
    const list = filesToDownload || files || [];
    if (!list.length) return;
    // Open each file in a new tab — browser triggers direct Drive download (zero server cost)
    list.forEach((f, i) => {
      setTimeout(() => window.open(f.download_url, '_blank'), i * 250);
    });
    toast.success(`ההורדה החלה (${list.length} קבצים)`);
  };

  const handleFileUploaded = (file) => {
    // Add to optimistic list — appears in grid instantly
    setOptimistic((prev) => [file, ...prev]);
    // Refetch to get the canonical version (and clear optimistic eventually)
    setTimeout(() => {
      refetch().then(() => {
        // Trim optimistic items that already exist on server
        setOptimistic((prev) =>
          prev.filter((o) => !(data?.files || []).some((s) => s.id === o.id))
        );
      });
    }, 1500);
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    await base44.functions.invoke('deleteDriveItem', {
      project_id: project.id,
      delete_project_folder: true,
      delete_project_record: true,
    });
    toast.success('הפרויקט והתיקייה נמחקו');
    queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
    setDeleting(false);
    setDeleteOpen(false);
    onProjectDeleted?.();
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`למחוק את "${file.name}" מ-Google Drive?`)) return;
    await base44.functions.invoke('deleteDriveItem', {
      project_id: project.id,
      file_id: file.id,
    });
    toast.success('הקובץ נמחק מ-Google Drive');
    setOptimistic((prev) => prev.filter((item) => item.id !== file.id));
    queryClient.invalidateQueries({ queryKey: ['driveFiles', project.id] });
    refetch();
  };

  // === No folder yet — show prominent Connect/Create button + Link existing ===
  if (!project.drive_folder_url) {
    return (
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/30">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-white rounded-2xl shadow-sm">
            <GoogleDriveIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            חבר תיקייה ב-Google Drive
          </h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
            צור תיקייה אוטומטית עם תתי-תיקיות (גלמים, ערוכות, בחירת לקוח, מסמכים) או קשר תיקייה קיימת. הקבצים נשארים אצלך ב-Drive, מבודדים לפרויקט הזה בלבד.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={handleCreateFolder} disabled={creating} className="gap-2">
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleDriveIcon className="w-5 h-5" />
              )}
              {creating ? 'יוצר...' : 'צור תיקייה אוטומטית'}
            </Button>
            <LinkDriveFolderDialog
              project={project}
              onLinked={() => {
                queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
                queryClient.invalidateQueries({ queryKey: ['driveFiles', project.id] });
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* === GIANT "Open in Drive" button — foolproof for non-technical users === */}
      <a
        href={project.drive_folder_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white via-blue-50/40 to-amber-50/30 border-2 border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200 active:scale-[0.99]"
      >
        <div className="flex items-center gap-4 md:gap-6 p-5 md:p-7">
          <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 flex items-center justify-center bg-white rounded-2xl shadow-md group-hover:shadow-lg transition-shadow">
            <GoogleDriveIcon className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              תיקיית הפרויקט
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
              פתח ב-Google Drive
            </div>
            <div className="text-sm text-slate-500">
              לחץ כאן לפתיחת התיקייה הספציפית של הפרויקט הזה
            </div>
          </div>
          <div className="shrink-0 hidden md:flex items-center gap-2 text-blue-600 group-hover:translate-x-[-4px] transition-transform">
            <ExternalLink className="w-6 h-6" />
          </div>
        </div>
      </a>

      {/* Inline Drive Folder URL editor — always visible, foolproof binding */}
      <DriveFolderUrlEditor
        project={project}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
          queryClient.invalidateQueries({ queryKey: ['driveFiles', project.id] });
        }}
      />

      {/* MASSIVE Send Gallery CTA */}
      <div className="flex items-center justify-center md:justify-start">
        <MagicLinkButton project={project} />
      </div>

      {/* Secondary toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => document.getElementById(`drive-file-input-${project.id}`)?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            העלאת קובץ
          </Button>
          <DriveCreateFolderDialog projectId={project.id} onCreated={() => refetch()} />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4" />
            מחק פרויקט
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-slate-900 border-slate-300">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          רענון
        </Button>
      </div>

      {/* Upload zone */}
      <Card id="drive-upload-zone">
        <CardContent className="p-5">
          <DriveUploader
            projectId={project.id}
            subfolder="edited"
            onFileUploaded={handleFileUploaded}
          />
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardContent className="p-6">
          <DriveFilesGrid
            files={files}
            project={project}
            loading={isLoading}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
            onDeleteFile={handleDeleteFile}
          />
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              האם למחוק את הפרויקט?
            </AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הפרויקט מהמערכת וגם את תיקיית הפרויקט ב-Google Drive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'מוחק...' : 'כן, מחק פרויקט'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}