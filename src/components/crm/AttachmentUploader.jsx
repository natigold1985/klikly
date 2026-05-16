import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AttachmentUploader({ relatedType, relatedId, clientName, attachments = [], onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    const fileList = Array.from(files || []);
    if (!fileList.length || !relatedId) return;
    setUploading(true);
    try {
      for (const file of fileList) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.Attachment.create({
          related_to_type: relatedType,
          related_to_id: relatedId,
          client_name: clientName,
          file_name: file.name,
          file_url,
          file_type: file.type || file.name.split('.').pop(),
          file_size: file.size,
        });
      }
      toast.success('הקבצים צורפו בהצלחה');
      onUploaded?.();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2" onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.csv,.pdf,image/*,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Paperclip className="w-4 h-4" />
          Attachments ({attachments.length})
        </div>
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading} className="h-8 text-xs bg-slate-900 text-white">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Upload
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1 max-h-20 overflow-auto">
          {attachments.slice(0, 3).map((file) => (
            <a key={file.id} href={file.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-blue-700 hover:underline">
              {file.file_name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}