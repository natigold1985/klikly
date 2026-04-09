import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Video, FileImage, Film, Trash2, Download, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '../components/FileUploader';
import { toast } from 'sonner';

export default function FileStorage() {
  const [activeTab, setActiveTab] = useState('raw');
  
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const isClient = user?.role === 'client';

  const { data: photos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['photos', projectId, activeTab, isClient, user?.email],
    queryFn: async () => {
      let query = {};
      
      if (isClient) {
        // If client, fetch only photos from projects associated with their email
        const clientProjects = await base44.entities.Project.filter({ client_email: user.email });
        const projectIds = clientProjects.map(p => p.id);
        
        if (projectIds.length === 0) return [];
        
        // If they requested a specific project, ensure it's one of theirs
        if (projectId) {
          if (!projectIds.includes(projectId)) return [];
          query.project_id = projectId;
        } else {
          query.project_id = { $in: projectIds };
        }
      } else {
        if (projectId) query.project_id = projectId;
      }
      
      if (activeTab.includes('raw')) query.type = 'raw';
      else if (activeTab.includes('edited') || activeTab.includes('final')) query.type = 'edited';
      else query.type = 'raw';

      return base44.entities.Photo.filter(query, '-created_date', 100);
    },
    enabled: !!user
  });

  const handleUploadComplete = async (uploadedFiles) => {
    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        let type = 'raw';
        if (activeTab.includes('edited') || activeTab.includes('final')) type = 'edited';
        
        const photoPromises = uploadedFiles.map(file => 
          base44.entities.Photo.create({
            project_id: projectId || 'general',
            type: type,
            file_url: file.file_url,
            file_name: file.file_name,
            file_size: file.file_size
          })
        );
        await Promise.all(photoPromises);
        
        queryClient.invalidateQueries({ queryKey: ['photos'] });
        toast.success("הקבצים הועלו ונשמרו בהצלחה");
      } catch (err) {
        console.error("Error creating photo records", err);
        toast.error("שגיאה בשמירת פרטי הקבצים");
      }
    }
  };

  const deletePhoto = async (id) => {
    if(confirm('למחוק את הקובץ?')) {
      try {
        await base44.entities.Photo.delete(id);
        queryClient.invalidateQueries({ queryKey: ['photos'] });
        toast.success("הקובץ נמחק");
      } catch(e) {
        toast.error("שגיאה במחיקת הקובץ");
      }
    }
  };

  const updatePhotoStatus = async (id, status) => {
    try {
      await base44.entities.Photo.update(id, { editing_status: status });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      toast.success("סטטוס העריכה עודכן");
    } catch(e) {
      toast.error("שגיאה בעדכון הסטטוס");
    }
  };

  const tabs = [
    { id: 'raw', label: 'חומר גלם', icon: FileImage },
    { id: 'editing', label: 'תמונות לעריכה', icon: Image },
    { id: 'edited', label: 'תמונות לאחר עריכה', icon: Image },
    { id: 'video-raw', label: 'קובצי וידאו חומר גלם', icon: Video },
    { id: 'video-final', label: 'סרטונים מוכנים', icon: Film },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          אחסון קבצים
        </h1>
        <p className="text-slate-600">ניהול כל קבצי הפרויקטים שלך במקום אחד</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4AF37] data-[state=active]:to-[#C5A028] data-[state=active]:text-black"
              >
                <Icon className="w-4 h-4 ml-2" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <tab.icon className="w-5 h-5 text-[#D4AF37]" />
                  {tab.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!isClient && (
                  <div className="mb-8">
                    <FileUploader 
                      projectId={projectId} 
                      onUploadComplete={handleUploadComplete} 
                      acceptedTypes={tab.id.includes('video') ? 'video/*' : 'image/*'}
                    />
                  </div>
                )}

                {isLoadingPhotos ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <tab.icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">אין קבצים ב{tab.label}</p>
                    <p className="text-sm text-slate-400 mt-1">העלה קבצים כדי לראות אותם כאן</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        {photo.file_url.match(/\.(mp4|webm|mov|avi)$/i) ? (
                          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white">
                            <Video className="w-8 h-8 mb-2 opacity-70" />
                            <span className="text-xs max-w-[90%] truncate px-2">{photo.file_name}</span>
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-100 z-0">
                              <FileImage className="w-8 h-8 mb-2 opacity-50" />
                              <span className="text-xs max-w-[90%] truncate px-2" title={photo.file_name}>{photo.file_name}</span>
                            </div>
                            <img 
                              src={photo.file_url} 
                              alt={photo.file_name} 
                              className="relative z-10 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 text-transparent"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.opacity = 0;
                              }}
                            />
                          </>
                        )}
                        
                        {/* Client Comment Badge */}
                        {photo.client_comment && (
                          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1.5 rounded-lg flex items-start gap-2 z-30 max-w-[90%] border border-[#FFD700]/30 shadow-xl">
                            <MessageSquare className="w-3.5 h-3.5 text-[#FFD700] shrink-0 mt-0.5" />
                            <p className="text-[10px] text-white font-medium leading-tight line-clamp-3">
                              {photo.client_comment}
                            </p>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-200 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 gap-3 z-20">
                          
                          {!isClient && photo.is_selected && (
                            <div className="flex gap-2 mb-2" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => updatePhotoStatus(photo.id, 'in_progress')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${photo.editing_status === 'in_progress' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/20 text-white hover:bg-blue-500'}`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                בטיפול
                              </button>
                              <button 
                                onClick={() => updatePhotoStatus(photo.id, 'finalized')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${photo.editing_status === 'finalized' ? 'bg-green-500 text-white shadow-lg' : 'bg-white/20 text-white hover:bg-green-500'}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                ערוך
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                          <a 
                            href={photo.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center backdrop-blur-sm transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {!isClient && (
                            <button 
                              onClick={() => deletePhoto(photo.id)}
                              className="w-8 h-8 rounded-full bg-[#FFD700]/80 hover:bg-[#FFD700] text-black flex items-center justify-center backdrop-blur-sm transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          </div>
                        </div>
                        
                        {/* File Name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <p className="text-xs text-white truncate drop-shadow-md">
                            {photo.file_name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}