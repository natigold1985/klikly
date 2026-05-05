import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, FolderOpen, RefreshCw, Cloud, Loader2 } from 'lucide-react';
import DriveFilesGrid from './DriveFilesGrid';
import MagicLinkButton from './MagicLinkButton';
import DriveUploader from './DriveUploader';
import GoogleDriveIcon from './GoogleDriveIcon';
import { toast } from 'sonner';

// Photographer view: pulls files directly from a project's Google Drive folder.
// Zero-cost — files stay in the photographer's Drive account.
export default function DriveProjectView({ project }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
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

  // === No folder yet — show prominent Connect/Create button ===
  if (!project.drive_folder_url) {
    return (
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/30">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-white rounded-2xl shadow-sm">
            <GoogleDriveIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            צור תיקייה ב-Google Drive
          </h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
            תיקייה אוטומטית עם תתי-תיקיות (גלמים, ערוכות, בחירת לקוח, מסמכים) — הקבצים נשארים אצלך ב-Drive, מבודדים מהרוט.
          </p>
          <Button onClick={handleCreateFolder} disabled={creating} className="gap-2">
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleDriveIcon className="w-5 h-5" />
            )}
            {creating ? 'יוצר...' : 'חבר ל-Google Drive'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            רענון
          </Button>
          <a
            href={project.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            <GoogleDriveIcon className="w-4 h-4" />
            פתח ב-Drive
            <ExternalLink className="w-3 h-3" />
          </a>
          <MagicLinkButton project={project} />
        </div>
      </div>

      {/* Upload zone */}
      <Card>
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
          <DriveFilesGrid files={files} loading={isLoading} onDownload={handleDownload} />
        </CardContent>
      </Card>
    </div>
  );
}