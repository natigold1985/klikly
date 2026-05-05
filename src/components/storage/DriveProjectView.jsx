import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, FolderOpen, RefreshCw, Cloud } from 'lucide-react';
import DriveFilesGrid from './DriveFilesGrid';
import MagicLinkButton from './MagicLinkButton';
import { toast } from 'sonner';

// Photographer view: pulls files directly from a project's Google Drive folder.
// Zero-cost — files stay in the photographer's Drive account.
export default function DriveProjectView({ project, onBack }) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['driveFiles', project.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFiles', { project_id: project.id });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed');
      return res.data;
    },
    enabled: !!project.id,
  });

  const files = data?.files || [];
  const folderMissing = data?.folder_missing;

  const handleCreateFolder = async () => {
    const res = await base44.functions.invoke('createDriveFolder', { project_id: project.id });
    if (res.status === 200) {
      toast.success('התיקייה נוצרה ב-Google Drive');
      refetch();
    } else {
      toast.error(res.data?.error || 'שגיאה ביצירת תיקייה');
    }
  };

  const handleDownload = (file) => {
    window.open(file.download_url, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            רענון
          </Button>
          {project.drive_folder_url && (
            <a
              href={project.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              פתח ב-Drive
            </a>
          )}
          <MagicLinkButton project={project} />
        </div>
      </div>

      {folderMissing && !project.drive_folder_url ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium mb-1">עדיין אין תיקייה ב-Google Drive</p>
            <p className="text-sm text-slate-500 mb-4">צור תיקייה אוטומטית עם תתי-תיקיות (גלמים, ערוכות, בחירת לקוח, מסמכים)</p>
            <Button onClick={handleCreateFolder} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              צור תיקייה ב-Drive
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <DriveFilesGrid files={files} loading={isLoading} onDownload={handleDownload} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}