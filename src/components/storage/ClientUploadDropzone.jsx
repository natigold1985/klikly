import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle2, AlertCircle, RotateCw, X, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// Anonymous client upload zone (used inside MagicGallery /g/:token).
// Uploads files directly to the project's bound Google Drive folder ("בחירת לקוח" subfolder)
// via the `uploadToDrive` function using the project's client_access_token (no login required).
export default function ClientUploadDropzone({ token, onUploaded }) {
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const setItem = (id, patch) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const uploadOne = async (item) => {
    try {
      setItem(item.id, { status: 'uploading', progress: 15, error: null });

      const { file_url } = await base44.integrations.Core.UploadFile({ file: item.file });
      setItem(item.id, { progress: 60 });

      const res = await base44.functions.invoke('uploadToDrive', {
        token,
        file_url,
        file_name: item.file.name,
        mime_type: item.file.type || 'application/octet-stream',
      });
      if (res.status !== 200 || !res.data?.success) {
        throw new Error(res.data?.error || `Status ${res.status}`);
      }

      setItem(item.id, { status: 'success', progress: 100 });
      onUploaded?.(res.data.file);
      setTimeout(() => setItems((p) => p.filter((it) => it.id !== item.id)), 1500);
    } catch (err) {
      console.error('Client upload failed:', err);
      setItem(item.id, { status: 'error', error: err.message || 'העלאה נכשלה' });
      toast.error(`נכשל: ${item.file.name}`);
    }
  };

  const handleSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const newItems = picked.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
    }));
    setItems((prev) => [...newItems, ...prev]);
    newItems.forEach(uploadOne);
    e.target.value = '';
  };

  const fmt = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-white/20 rounded-2xl p-6 md:p-8 text-center cursor-pointer hover:border-[#FFD700] hover:bg-white/5 transition-all"
      >
        <Upload className="w-9 h-9 mx-auto text-white/50 mb-2" />
        <p className="text-white/90 font-medium text-sm md:text-base">העלאת קבצי השראה / הפניה</p>
        <p className="text-xs text-white/50 mt-1">תמונות ווידאו · יישלחו ישירות לתיקיית הצלם ב-Drive</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => {
            const FileIcon = it.file.type?.startsWith('video/') ? Video : ImageIcon;
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  it.status === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : it.status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <FileIcon className="w-5 h-5 text-white/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">{it.file.name}</p>
                    <span className="text-xs text-white/50 shrink-0">{fmt(it.file.size)}</span>
                  </div>
                  {it.status === 'uploading' && <Progress value={it.progress} className="h-1.5" />}
                  {it.status === 'error' && (
                    <p className="text-xs text-red-400 truncate">{it.error}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {it.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {it.status === 'uploading' && <Loader2 className="w-5 h-5 text-[#FFD700] animate-spin" />}
                  {it.status === 'error' && (
                    <button
                      onClick={() => uploadOne(it)}
                      className="p-1.5 hover:bg-white/10 rounded-md"
                      title="נסה שוב"
                    >
                      <RotateCw className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}