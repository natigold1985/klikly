import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle2, AlertCircle, Image, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function FileUploader({ projectId, onUploadComplete, acceptedTypes = 'image/*,video/*' }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    const newFiles = selectedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending', // pending, uploading, success, error
      uploadedUrl: null,
      error: null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (fileItem) => {
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading', progress: 10 } : f
      ));

      // Step 1: Get presigned URL
      const response = await base44.functions.invoke('generatePresignedUrl', {
        fileName: fileItem.file.name,
        fileType: fileItem.file.type,
        fileSize: fileItem.file.size,
        projectId: projectId
      });
      
      const { uploadUrl, fileKey } = response.data;

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, progress: 30 } : f
      ));

      // Step 2: Upload directly to S3 (Bunny.net)
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': fileItem.file.type,
        },
        body: fileItem.file
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed');
      }

      const file_url = `https://de.s3.bunnycdn.com/natiklikly/${fileKey}`;

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, progress: 100, status: 'success', uploadedUrl: file_url } : f
      ));

      return {
        file_url,
        file_name: fileItem.file.name,
        file_size: fileItem.file.size,
        type: fileItem.file.type
      };
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'error', error: error.message || 'העלאה נכשלה' } : f
      ));
      throw error;
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    try {
      const uploadPromises = pendingFiles.map(fileItem => uploadFile(fileItem));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      if (onUploadComplete) {
        onUploadComplete(uploadedUrls.filter(Boolean));
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5 text-indigo-500" />;
    } else if (file.type.startsWith('video/')) {
      return <Video className="w-5 h-5 text-purple-500" />;
    }
    return null;
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all"
      >
        <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
        <p className="text-slate-700 font-medium mb-1">לחץ להעלאת קבצים</p>
        <p className="text-sm text-slate-500">תמונות ווידאו עד 500MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="space-y-3">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {getFileIcon(fileItem.file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {fileItem.file.name}
                      </p>
                      <span className="text-xs text-slate-500 mr-2">
                        {formatFileSize(fileItem.file.size)}
                      </span>
                    </div>
                    {fileItem.status === 'uploading' && (
                      <Progress value={fileItem.progress} className="h-1" />
                    )}
                    {fileItem.status === 'error' && (
                      <p className="text-xs text-red-600">{fileItem.error}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {fileItem.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(fileItem.id); }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                    {fileItem.status === 'success' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {fileItem.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Upload Summary */}
            {files.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">{files.length}</span> קבצים
                    {successCount > 0 && <span className="text-green-600 mr-2">• {successCount} הועלו</span>}
                    {errorCount > 0 && <span className="text-red-600 mr-2">• {errorCount} נכשלו</span>}
                  </div>
                  {pendingCount > 0 && (
                    <Button
                      onClick={handleUploadAll}
                      disabled={uploading}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    >
                      {uploading ? 'מעלה...' : `העלה ${pendingCount} קבצים`}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}