import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadRadarWidget() {
  const [isScanning, setIsScanning] = useState(false);

  const { data: radarLeads, refetch } = useQuery({
    queryKey: ['radarLeads'],
    queryFn: async () => {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const sheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
        const range = encodeURIComponent("'Claude Code'!A1:K100");
        
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data.values || [];
        
        // Skip header, filter rows without "כן" in sent column (index 9)
        return rows.slice(1).filter(row => row[9] !== 'כן').map((row, idx) => ({
          idx,
          title: row[0] || '',
          platform: row[1] || '',
          phone: row[2] || '',
          email: row[3] || '',
          keywords: row[4] || '',
          snippet: row[5] || '',
          notes: row[7] || '',
          url: row[8] || '',
          updated: row[10] || '',
        })).slice(0, 5); // Show top 5 unsent
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await base44.functions.invoke('scanLeadRadar', {});
      toast.success(`✅ ${res.data.summary}`);
      refetch();
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  if (!radarLeads?.length) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-orange-600" />
            Claude Code Radar 🎯
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">אין לידים חדשים מ-LinkedIn Security. לחץ להסריקה.</p>
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            className="bg-orange-600 hover:bg-orange-700 text-white w-full"
          >
            {isScanning ? 'סורק...' : 'סרוק עכשיו'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-orange-600" />
            Claude Code Radar 🎯
          </CardTitle>
          <Button 
            size="sm"
            onClick={handleScan} 
            disabled={isScanning}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isScanning ? 'סורק...' : 'סרוק מחדש'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {radarLeads.map((lead) => (
            <div key={lead.idx} className="bg-white p-3 rounded-lg border border-orange-100 hover:border-orange-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">{lead.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{lead.keywords}</p>
                  {lead.phone && <p className="text-xs text-slate-500">📱 {lead.phone}</p>}
                  {lead.email && <p className="text-xs text-slate-500">✉️ {lead.email}</p>}
                </div>
                {lead.url && (
                  <a
                    href={lead.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 p-2 hover:bg-orange-100 rounded text-orange-600 transition-colors"
                    title="פתח בקישור"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 text-center pt-2">הזנו לטבלת Leads כשתאישרו ידנית</p>
        </div>
      </CardContent>
    </Card>
  );
}