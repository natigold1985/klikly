import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radar, Loader2, ExternalLink, Eye, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const platformLabels = {
  facebook: { label: 'Facebook', color: 'bg-blue-100 text-blue-700' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  linkedin: { label: 'LinkedIn', color: 'bg-sky-100 text-sky-700' },
  forum: { label: 'פורום', color: 'bg-emerald-100 text-emerald-700' },
  job_board: { label: 'לוח דרושים', color: 'bg-orange-100 text-orange-700' },
  other: { label: 'אחר', color: 'bg-slate-100 text-slate-600' },
};

export default function LeadRadarWidget() {
  const [isScanning, setIsScanning] = useState(false);
  const queryClient = useQueryClient();

  const { data: potentialLeads = [] } = useQuery({
    queryKey: ['potentialLeads'],
    queryFn: () => base44.entities.PotentialLead.filter({ status: 'new' }, '-created_date', 10),
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await base44.functions.invoke('scanLeadRadar', {});
      queryClient.invalidateQueries({ queryKey: ['potentialLeads'] });
      toast.success(`רדאר: ${res.data.found} תוצאות, ${res.data.saved} חדשות נשמרו`);
    } catch (e) {
      toast.error('שגיאה בסריקה: ' + e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDismiss = async (id) => {
    await base44.entities.PotentialLead.update(id, { status: 'dismissed' });
    queryClient.invalidateQueries({ queryKey: ['potentialLeads'] });
  };

  const handleReview = async (id) => {
    await base44.entities.PotentialLead.update(id, { status: 'reviewed' });
    queryClient.invalidateQueries({ queryKey: ['potentialLeads'] });
  };

  return (
    <Card className="border rounded-2xl border-[#C5A028]/30 bg-gradient-to-br from-[#FFD700]/5 to-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="w-5 h-5 text-[#C5A028]" />
            רדאר לידים AI
          </CardTitle>
          <p className="text-[11px] text-slate-400 mt-1">
            סורק פורומים, קבוצות פייסבוק, לוחות דרושים ורשתות חברתיות — אוטומטית פעמיים ביום (09:00 ו-21:00)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          disabled={isScanning}
          className="gap-1.5 border-[#C5A028]/30 text-[#C5A028] hover:bg-[#FFD700]/10 shrink-0"
        >
          {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          סרוק עכשיו
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {potentialLeads.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            <Radar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>הרדאר סורק אוטומטית את הרשת בחיפוש אנשים שמחפשים צלם.</p>
            <p className="text-xs mt-1">תוצאות חדשות יופיעו כאן. אפשר גם ללחוץ "סרוק עכשיו".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {potentialLeads.map(lead => {
              const plat = platformLabels[lead.platform] || platformLabels.other;
              return (
                <div key={lead.id} className="p-3 rounded-xl bg-white border border-slate-100 hover:border-[#C5A028]/30 transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{lead.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${plat.color} text-[10px] px-1.5 py-0`}>{plat.label}</Badge>
                        {lead.relevance_score >= 7 && (
                          <Badge className="bg-[#FFD700]/20 text-[#C5A028] text-[10px] px-1.5 py-0">
                            רלוונטי מאוד
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#C5A028] bg-[#FFD700]/10 px-2 py-1 rounded-lg shrink-0">
                      {lead.relevance_score}/10
                    </span>
                  </div>
                  
                  {lead.snippet && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{lead.snippet}</p>
                  )}

                  {lead.contact_info && lead.contact_info !== 'N/A' && (
                    <p className="text-xs text-green-600 font-medium mb-2">📞 {lead.contact_info}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {lead.source_url && lead.source_url !== 'N/A' && (
                      <a href={lead.source_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-600 hover:bg-blue-50">
                          <ExternalLink className="w-3 h-3" /> צפה
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-600 hover:bg-green-50" onClick={() => handleReview(lead.id)}>
                      <Eye className="w-3 h-3" /> נבדק
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-400 hover:bg-slate-50" onClick={() => handleDismiss(lead.id)}>
                      <X className="w-3 h-3" /> בטל
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}