import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Copy, CheckCircle2, Loader2, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function generateToken() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export default function DeliveryLinkButton({ project }) {
  const [open, setOpen] = useState(false);
  const [fileSizeLabel, setFileSizeLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: existingLinks = [] } = useQuery({
    queryKey: ['deliveryLink', project.id],
    queryFn: () => base44.entities.DeliveryLink.filter({ project_id: project.id }),
    enabled: open,
  });

  const existingLink = existingLinks[0];
  const downloadedAt = existingLink?.downloaded_at ? new Date(existingLink.downloaded_at) : null;

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const token = generateToken();
      return base44.entities.DeliveryLink.create({
        project_id: project.id,
        token,
        file_url: project.drive_folder_url || '',
        photographer_email: project.created_by,
        client_name: project.client_name,
        project_title: project.shooting_type || project.client_name,
        file_size_label: fileSizeLabel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryLink', project.id] });
      toast.success('לינק הורדה נוצר בהצלחה!');
    },
  });

  const getDownloadUrl = (token) => {
    return `${window.location.origin}${createPageUrl(`DownloadPage?token=${token}`)}`;
  };

  const handleCopy = (token) => {
    navigator.clipboard.writeText(getDownloadUrl(token));
    setCopied(true);
    toast.success('הלינק הועתק!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-xs flex-1 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className="w-3 h-3 ml-1" />
          לינק הורדה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#D4AF37]" />
            לינק הורדה ללקוח — {project.client_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {existingLink ? (
            <div className="space-y-4">
              {/* Existing Link */}
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">הלינק מוכן!</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={getDownloadUrl(existingLink.token)}
                    readOnly
                    className="text-xs bg-white"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopy(existingLink.token)}
                    className="bg-[#D4AF37] hover:bg-[#C5A028] text-black flex-shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <a
                  href={getDownloadUrl(existingLink.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  תצוגה מקדימה
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border text-center">
                  <p className="text-2xl font-bold text-slate-800">{existingLink.view_count || 0}</p>
                  <p className="text-xs text-slate-500">כניסות ללינק</p>
                </div>
                <div className={`p-3 rounded-lg border text-center ${downloadedAt ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                  {downloadedAt ? (
                    <>
                      <CheckCircle2 className="w-7 h-7 text-green-600 mx-auto mb-1" />
                      <p className="text-xs font-bold text-green-800">
                        הורד ב-{downloadedAt.toLocaleDateString('he-IL')} {downloadedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-7 h-7 text-orange-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-orange-700">טרם הורד</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                צור לינק ייחודי ללקוח להורדת הקבצים. הצלם יקבל התראה כשהלקוח יוריד.
              </p>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
                הלינק ייפתח ישירות מתיקיית Google Drive שמחוברת לפרויקט.
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  גודל הקובץ (אופציונלי)
                </label>
                <Input
                  value={fileSizeLabel}
                  onChange={(e) => setFileSizeLabel(e.target.value)}
                  placeholder="למשל: 1.2GB, 450 תמונות"
                />
              </div>
              <Button
                onClick={() => createLinkMutation.mutate()}
                disabled={!project.drive_folder_url || createLinkMutation.isPending}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black font-bold"
              >
                {createLinkMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Link2 className="w-4 h-4 ml-2" />
                )}
                צור לינק הורדה
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}