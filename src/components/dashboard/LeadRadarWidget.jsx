import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar, Linkedin } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadRadarWidget() {
  const [isScanning, setIsScanning] = useState(false);

  const { data: radarLeads = [], refetch } = useQuery({
    queryKey: ['linkedinLeadRadar'],
    queryFn: async () => {
      try {
        // Invoke Base44 LinkedIn Lead Radar through backend function
        const res = await base44.functions.invoke('scanLinkedInLeads', {});
        return res.data?.leads || [];
      } catch (err) {
        console.error('Failed to fetch LinkedIn leads:', err);
        return [];
      }
    },
    staleTime: 60000,
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await base44.functions.invoke('scanLinkedInLeads', {});
      if (res.data?.success) {
        toast.success(`✅ ${res.data.summary || 'סקן הושלם'} - ${res.data.found || 0} לידים חדשים`);
        refetch();
      } else {
        toast.error('❌ שגיאה בסקן');
      }
    } catch (err) {
      console.error('LinkedIn scan error:', err);
      toast.error(`❌ ${err.message || 'שגיאה בסקן LinkedIn'}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Linkedin className="w-5 h-5 text-blue-600" />
            LinkedIn Radar - תעשיית ביטחון 🔐
            <span className="text-xs font-normal text-blue-600 ml-2">({radarLeads.length} חדשים)</span>
          </CardTitle>
          <Button 
            size="sm"
            onClick={handleScan} 
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isScanning ? '⏳ סורק...' : '🔍 סרוק עכשיו'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {radarLeads.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm mb-3">אין לידים חדשים מ-LinkedIn תעשיית ביטחון</p>
            <Button 
              onClick={handleScan} 
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              {isScanning ? 'סורק...' : 'הפעל סריקה ידנית'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {radarLeads.slice(0, 10).map((lead, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-600 mt-1">{lead.title}</p>
                    <p className="text-xs text-slate-500">{lead.company}</p>
                    {lead.phone && <p className="text-xs text-slate-500">📱 {lead.phone}</p>}
                    {lead.email && <p className="text-xs text-slate-500">✉️ {lead.email}</p>}
                  </div>
                  {lead.profileUrl && (
                    <a
                      href={lead.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-2 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                      title="פתח פרופיל LinkedIn"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500 text-center pt-2">לידים אלה מממתינים לאישור ידנית לפני הוספה למערכת</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}