import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, ArrowRight, Trash2, Download, FileImage, Video, Upload, MessageSquare } from 'lucide-react';
import FileUploader from '../components/FileUploader';
import CreateClientDialog from '../components/storage/CreateClientDialog';
import ClientCard from '../components/storage/ClientCard';
import { toast } from 'sonner';

export default function FileStorage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  // Fetch clients (for photographers/admin)
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['myClients', user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyClients', {});
      return res.data?.clients || [];
    },
    enabled: !!user && !isClient,
  });

  // Fetch photos: for client => own edited photos only, for photographer => selected client's photos
  const photosClientEmail = isClient ? user?.email : selectedClient?.email;
  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['clientPhotos', photosClientEmail, isClient],
    queryFn: () => {
      const filter = { client_email: photosClientEmail };
      if (isClient) filter.type = 'edited';
      return base44.entities.Photo.filter(filter, '-created_date', 500);
    },
    enabled: !!photosClientEmail,
  });

  const handleUploadComplete = async (uploadedFiles) => {
    if (!uploadedFiles?.length || !selectedClient) return;
    try {
      const photoPromises = uploadedFiles.map(file =>
        base44.entities.Photo.create({
          client_email: selectedClient.email,
          type: 'edited',
          file_url: file.file_url,
          file_name: file.file_name,
          file_size: file.file_size,
        })
      );
      await Promise.all(photoPromises);

      // Notify client
      base44.functions.invoke('notifyClientNewFiles', {
        client_email: selectedClient.email,
        file_count: uploadedFiles.length,
      }).catch(console.error);

      queryClient.invalidateQueries({ queryKey: ['clientPhotos', selectedClient.email] });
      queryClient.invalidateQueries({ queryKey: ['myClients'] });
      toast.success('הקבצים הועלו והלקוח קיבל התראה');
    } catch (e) {
      toast.error('שגיאה בהעלאה');
    }
  };

  const deletePhoto = async (id) => {
    if (!confirm('למחוק את הקובץ?')) return;
    await base44.entities.Photo.delete(id);
    queryClient.invalidateQueries({ queryKey: ['clientPhotos'] });
    toast.success('הקובץ נמחק');
  };

  const filteredClients = clients.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // CLIENT VIEW – show their files directly
  if (isClient) {
    return (
      <div className="space-y-6 pb-20" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">הקבצים שלי</h1>
          <p className="text-slate-600 text-sm">הקבצים זמינים להורדה למשך 3 חודשים</p>
        </div>
        <PhotoGrid photos={photos} loading={loadingPhotos} canDelete={false} />
      </div>
    );
  }

  // PHOTOGRAPHER/ADMIN VIEW
  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {!selectedClient ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">אחסון קבצים</h1>
              <p className="text-slate-600 text-sm">תיקייה אישית לכל לקוח</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              לקוח חדש
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לקוח..."
              className="pr-10"
            />
          </div>

          {loadingClients ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">אין עדיין לקוחות</p>
                <p className="text-sm text-slate-400 mt-1">לחץ על "לקוח חדש" כדי להתחיל</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  fileCount={c.file_count}
                  onClick={() => setSelectedClient(c)}
                />
              ))}
            </div>
          )}

          <CreateClientDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ['myClients'] })}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedClient(null)} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                חזרה
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{selectedClient.full_name}</h1>
                <p className="text-xs text-slate-500">{selectedClient.email}</p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <FileUploader onUploadComplete={handleUploadComplete} />
              </div>
              <PhotoGrid photos={photos} loading={loadingPhotos} canDelete={true} onDelete={deletePhoto} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PhotoGrid({ photos, loading, canDelete, onDelete }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <FileImage className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">אין קבצים</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm hover:shadow-md transition-all">
          {photo.file_url.match(/\.(mp4|webm|mov|avi)$/i) ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white">
              <Video className="w-8 h-8 mb-2 opacity-70" />
              <span className="text-xs max-w-[90%] truncate px-2">{photo.file_name}</span>
            </div>
          ) : (
            <img
              src={photo.file_url}
              alt={photo.file_name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2 z-20">
            <a
              href={photo.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                // Notify backend on every download (starts 90-day clock on first one + push to photographer + email confirmation)
                base44.functions.invoke('onClientFirstDownload', { file_name: photo.file_name }).catch(() => {});
              }}
              className="w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center"
            >
              <Download className="w-4 h-4" />
            </a>
            {canDelete && (
              <button onClick={() => onDelete(photo.id)} className="w-9 h-9 rounded-full bg-[#FFD700] text-black flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-xs text-white truncate">{photo.file_name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}