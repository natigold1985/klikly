import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Video, FileImage, Film } from 'lucide-react';

export default function FileStorage() {
  const [activeTab, setActiveTab] = useState('raw');

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
                  <Button className="bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black">
                    בחר קבצים
                  </Button>
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