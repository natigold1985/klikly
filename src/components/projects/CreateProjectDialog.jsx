import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CreateClientDialog from './CreateClientDialog';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Loader2, Upload, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateProjectDialog({ open, onOpenChange, onCreated }) {
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['projectClients'],
    queryFn: () => base44.entities.TeamMember.filter({ role: 'client' }, 'full_name', 300),
    enabled: open,
  });

  const selectedClient = clients.find((client) => client.email === clientEmail);

  const resetForm = () => {
    setProjectName('');
    setClientEmail('');
    setFiles([]);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !selectedClient) {
      toast.error('נא להזין שם פרויקט ולבחור לקוח');
      return;
    }

    setLoading(true);
    try {
      const project = await base44.entities.Project.create({
        project_name: projectName.trim(),
        client_name: selectedClient.full_name || selectedClient.email,
        client_email: selectedClient.email,
        client_phone: selectedClient.phone || '',
        shooting_type: projectName.trim(),
        status: 'shooting_scheduled',
        payment_status: 'pending',
        raw_photos_count: 0,
      });

      const folderRes = await base44.functions.invoke('createDriveFolder', { project_id: project.id });
      if (!folderRes.data?.success) {
        throw new Error(folderRes.data?.error || 'יצירת תיקיית Drive נכשלה');
      }

      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.functions.invoke('uploadToDrive', {
          project_id: project.id,
          file_url,
          file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          target_subfolder: 'raw',
        });
      }

      if (files.length > 0) {
        await base44.entities.Project.update(project.id, { raw_photos_count: files.length });
      }

      toast.success('הפרויקט נוצר וסונכרן ל-Google Drive');
      onCreated?.(project);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || 'שגיאה ביצירת הפרויקט');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[560px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#FFD700]" />
            פרויקט חדש
          </DialogTitle>
          <DialogDescription>
            יצירת פרויקט, תיקיית Google Drive והעלאת קבצים ראשונית במסלול אחד.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">שם הפרויקט *</label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="לדוגמה: צילומי משפחה לשירה"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">בחירת לקוח *</label>
            <div className="flex gap-2">
              <Select value={clientEmail} onValueChange={setClientEmail} className="flex-1">
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח קיים" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.email}>
                      {client.full_name || client.email} · {client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowCreateClient(true)}
                title="הוסף לקוח חדש"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">קבצים ראשוניים</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-[#FFD700] rounded-2xl p-6 cursor-pointer bg-slate-50 hover:bg-amber-50/40 transition-colors">
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">בחר קבצים מהמחשב</span>
              <span className="text-xs text-slate-500">תמונות או וידאו — יועלו לתיקיית RAW בדרייב</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <span className="truncate text-slate-700">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleCreate} disabled={loading} className="w-full gap-2 bg-[#FFD700] text-black hover:bg-[#E5B800]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
            {loading ? 'יוצר ומסנכרן...' : 'צור פרויקט וסנכרן ל-Drive'}
          </Button>
        </div>

        <CreateClientDialog
          open={showCreateClient}
          onOpenChange={setShowCreateClient}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['projectClients'] });
            setShowCreateClient(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}