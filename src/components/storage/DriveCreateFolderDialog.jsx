import React, { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const QUICK_FOLDERS = ['חומרי גלם', 'ערוכים', 'הסכמים', 'בחירת לקוח'];

export default function DriveCreateFolderDialog({ projectId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const createFolder = async (name = folderName) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    setCreating(true);
    const res = await base44.functions.invoke('createDriveSubfolder', {
      project_id: projectId,
      folder_name: cleanName,
    });
    setCreating(false);

    if (res.data?.success) {
      toast.success(res.data.already_exists ? 'התיקייה כבר קיימת' : 'התיקייה נוצרה ב-Drive');
      setFolderName('');
      setOpen(false);
      onCreated?.();
    } else {
      toast.error(res.data?.error || 'לא הצלחתי ליצור תיקייה');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 text-slate-900 border-slate-300">
        <FolderPlus className="w-4 h-4" />
        יצירת תיקייה חדשה
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-[#C5A028]" />
              יצירת תיקייה חדשה ב-Drive
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="לדוגמה: חומרי גלם / ערוכים / הסכמים"
              disabled={creating}
            />

            <div className="flex gap-2 flex-wrap">
              {QUICK_FOLDERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFolderName(name)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  {name}
                </button>
              ))}
            </div>

            <Button onClick={() => createFolder()} disabled={!folderName.trim() || creating} className="w-full gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {creating ? 'יוצר...' : 'צור תיקייה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}