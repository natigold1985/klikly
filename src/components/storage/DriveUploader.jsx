import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle2, AlertCircle, RotateCw, Image as ImageIcon, Video, ShieldCheck, FileText, Music } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MAX_CONCURRENT_UPLOADS = 3;

// Drive uploader with optimistic UI + retry. Uploads each file directly to the
// project's Drive subfolder via the `uploadToDrive` backend function.
//
// Props:
//  - projectId
//  - subfolder ('edited' | 'raw' | 'client' | 'docs')
//  - onFileUploaded(file) — called optimistically once Drive returns the file metadata
export default function DriveUploader({ projectId, subfolder = 'edited', onFileUploaded }) {
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStats, setUploadStats] = useState({ total: 0, completed: 0, failed: 0 });
  const fileInputRef = useRef(null);
  const queueRef = useRef([]);
  const activeUploadsRef = useRef(0);

  const startUploads = (picked) => {
    if (!picked.length) return;
    const newItems = picked.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
      error: null,
    }));
    setUploadStats((prev) => ({
      total: prev.total + newItems.length,
      completed: prev.completed,
      failed: prev.failed,
      skipped: prev.skipped || 0,
    }));
    setItems((prev) => [...newItems, ...prev]);
    queueRef.current = [...queueRef.current, ...newItems];
    processQueue();
  };

  const handleSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    startUploads(picked);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    startUploads(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const setItem = (id, patch) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isRateLimit = (err) => err?.status === 429 || err?.response?.status === 429 || /rate limit/i.test(err?.message || '');

  const withRetry = async (fn, itemId) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (!isRateLimit(err) || attempt === 2) throw err;
        setItem(itemId, { error: `עומס זמני, ניסיון נוסף בעוד 2 שניות...` });
        await sleep(2000);
      }
    }
  };

  const processQueue = () => {
    while (activeUploadsRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const nextItem = queueRef.current.shift();
      activeUploadsRef.current += 1;
      uploadOne(nextItem).finally(() => {
        activeUploadsRef.current -= 1;
        processQueue();
      });
    }
  };

  const uploadOne = async (item) => {
    let progressInterval = null;
    try {
      setItem(item.id, { status: 'uploading', progress: 5, error: null });

      // Smooth fake-progress while step 1 runs (creeps toward 45%)
      progressInterval = setInterval(() => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id && it.status === 'uploading' && it.progress < 45
              ? { ...it, progress: Math.min(45, it.progress + 2) }
              : it
          )
        );
      }, 200);

      const existsRes = await withRetry(
        () => base44.functions.invoke('uploadToDrive', {
          project_id: projectId,
          file_name: item.file.name,
          target_subfolder: subfolder,
          check_only: true,
        }),
        item.id
      );

      if (existsRes.data?.exists) {
        clearInterval(progressInterval);
        setItem(item.id, { status: 'skipped', progress: 100, error: 'קיים במערכת' });
        setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1, skipped: (prev.skipped || 0) + 1 }));
        return;
      }

      const initRes = await withRetry(
        () => base44.functions.invoke('uploadToDrive', {
          project_id: projectId,
          file_name: item.file.name,
          mime_type: item.file.type || 'application/octet-stream',
          file_size: item.file.size,
          target_subfolder: subfolder,
          direct_upload_init: true,
        }),
        item.id
      );

      const uploadUrl = initRes.data?.upload_url;
      if (!uploadUrl) throw new Error(initRes.data?.error || 'לא התקבלה כתובת העלאה מ-Google Drive');
      clearInterval(progressInterval);
      setItem(item.id, { progress: 45 });

      const driveFile = await uploadDirectToDrive(uploadUrl, item.file, (progress) => {
        setItem(item.id, { progress: Math.max(45, Math.min(95, progress)) });
      });

      const res = await withRetry(
        () => base44.functions.invoke('uploadToDrive', {
          project_id: projectId,
          file_name: item.file.name,
          mime_type: item.file.type || 'application/octet-stream',
          target_subfolder: subfolder,
          direct_upload_complete: true,
          drive_file: driveFile,
        }),
        item.id
      );

      if (res.status !== 200 || !res.data?.success) {
        throw new Error(res.data?.error || `Status ${res.status}`);
      }

      if (res.data?.skipped) {
        setItem(item.id, { status: 'skipped', progress: 100, error: res.data.message || 'קיים במערכת' });
        setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1, skipped: (prev.skipped || 0) + 1 }));
        return;
      }

      setItem(item.id, { status: 'success', progress: 100 });
      setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1 }));
      toast.success(`הועלה בהצלחה: ${item.file.name}`);
      // Optimistic UI: notify parent immediately so the file appears in the grid
      onFileUploaded?.(res.data.file);

      // remove successful items after a short delay so the user sees the ✓
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
      }, 1500);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Upload failed:', err);
      setItem(item.id, { status: 'error', error: err.message || 'העלאה נכשלה' });
      setUploadStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      toast.error(`נכשל: ${item.file.name}`);
    }
  };

  const retry = (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItem(id, { status: 'pending', progress: 0, error: null });
    setUploadStats((prev) => ({ ...prev, total: prev.total + 1 }));
    queueRef.current = [...queueRef.current, item];
    processQueue();
  };

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const fmt = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  const uploadDirectToDrive = (uploadUrl, file, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(45 + Math.round((event.loaded / event.total) * 50));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText || '{}'));
      } else {
        reject(new Error(`Google Drive upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('שגיאת רשת בהעלאה ל-Google Drive'));
    xhr.send(file);
  });

  const Icon = (type, name = '') => {
    const lower = String(name).toLowerCase();
    if (type?.startsWith('video/')) return Video;
    if (type?.startsWith('audio/')) return Music;
    if (type?.startsWith('image/')) return ImageIcon;
    if (type?.includes('pdf') || ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].some((ext) => lower.endsWith(ext))) return FileText;
    return FileText;
  };

  const activeCount = items.filter((it) => it.status === 'uploading').length;
  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const overallProgress = uploadStats.total ? Math.round(((uploadStats.completed + uploadStats.failed) / uploadStats.total) * 100) : 0;

  return (
    <div className="space-y-3">
      {uploadStats.total > 0 && uploadStats.completed + uploadStats.failed < uploadStats.total && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="font-bold text-blue-900">הועלו {uploadStats.completed} מתוך {uploadStats.total} קבצים</p>
            <p className="text-xs text-blue-700">פעילים עכשיו: {activeCount} · ממתינים בתור: {pendingCount}</p>
          </div>
          <Progress value={overallProgress} className="h-2" />
          {uploadStats.skipped > 0 && (
            <p className="text-xs text-emerald-700 mt-2">{uploadStats.skipped} קבצים כבר קיימים במערכת ודולגו בבטחה</p>
          )}
          {uploadStats.failed > 0 && (
            <p className="text-xs text-red-600 mt-2">{uploadStats.failed} קבצים נכשלו אחרי ניסיונות חוזרים</p>
          )}
        </div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#FFD700] bg-amber-50 scale-[1.01] shadow-lg'
            : 'border-slate-300 hover:border-[#FFD700] hover:bg-amber-50/30'
        }`}
      >
        <Upload className={`w-10 h-10 mx-auto mb-2 transition-colors ${isDragging ? 'text-[#b38f2d]' : 'text-slate-400'}`} />
        <p className="text-slate-700 font-medium">
          {isDragging ? 'שחרר כאן כדי להעלות' : 'גרור קבצים לכאן או לחץ לבחירה'}
        </p>
        <Button type="button" className="mt-4 gap-2">
          <Upload className="w-4 h-4" />
          העלאת קבצים
        </Button>
        <p className="text-xs text-slate-500 mt-3">תמונות, וידאו, מסמכים ואודיו · העלאה ישירה ויציבה ל-Google Drive</p>
        <input
          ref={fileInputRef}
          id={`drive-file-input-${projectId}`}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => {
            const FileIcon = Icon(it.file.type, it.file.name);
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  it.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : it.status === 'success' || it.status === 'skipped'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <FileIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{it.file.name}</p>
                    <span className="text-xs text-slate-500 flex-shrink-0">{fmt(it.file.size)}</span>
                  </div>
                  {it.status === 'uploading' && <Progress value={it.progress} className="h-1.5" />}
                  {it.status === 'pending' && (
                    <p className="text-xs text-slate-500">ממתין בתור להעלאה בטוחה</p>
                  )}
                  {it.status === 'skipped' && (
                    <p className="text-xs text-emerald-700 truncate">קיים במערכת — דולג, לא נוצר עותק כפול</p>
                  )}
                  {it.status === 'error' && (
                    <p className="text-xs text-red-600 truncate">{it.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {it.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {it.status === 'skipped' && (
                    <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold whitespace-nowrap">
                      <ShieldCheck className="w-5 h-5" />
                      קיים במערכת
                    </div>
                  )}
                  {it.status === 'error' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => retry(it.id)} className="h-8 gap-1">
                        <RotateCw className="w-3 h-3" />
                        נסה שוב
                      </Button>
                      <button
                        onClick={() => remove(it.id)}
                        className="p-1.5 hover:bg-red-100 rounded-md"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </>
                  )}
                  {it.status === 'uploading' && (
                    <span className="text-xs text-slate-500 w-10 text-left">{it.progress}%</span>
                  )}
                  {it.status === 'pending' && (
                    <button onClick={() => remove(it.id)} className="p-1.5 hover:bg-slate-200 rounded-md">
                      <X className="w-4 h-4 text-slate-500" />
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