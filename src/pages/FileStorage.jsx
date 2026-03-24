import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Video, FileImage, Film, Trash2, Download } from 'lucide-react';
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
    queryKey: ['photos', projectId, activeTab],
    queryFn: async () => {
      let query = {};
      if (projectId) query.project_id = projectId;
      
      if (activeTab.includes('raw')) query.type = 'raw';
      else if (activeTab.includes('edited') || activeTab.includes('final')) query.type = 'edited';
      else query.type = 'raw';

      return base44.entities.Photo.filter(query, '-created_date', 100);
    }
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
              <CardContent>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-[#D4AF37] transition-colors">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">גרור קבצים לכאן או לחץ להעלאה</p>
                  {!isClient && (
                    <Button className="bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black">
                      בחר קבצים
                    </Button>
                  )}
                </div>

                {/* Empty State */}
                <div className="text-center py-8 text-slate-500">
                  <p>אין קבצים ב{tab.label}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}