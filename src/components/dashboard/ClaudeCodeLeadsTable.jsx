import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClaudeCodeLeadsTable() {
  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['claudeCodeLeads'],
    queryFn: async () => {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const sheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
        const range = encodeURIComponent("'Claude Code'!A2:K200");
        
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data.values || [];
        
        return rows.map((row, idx) => ({
          idx,
          name: row[0] || '',
          phone: row[2] || '',
          email: row[3] || '',
          keywords: row[4] || '',
          url: row[8] || '',
          sent: row[9] === 'כן',
        }));
      } catch (err) {
        console.error('Failed to fetch Claude Code leads:', err);
        return [];
      }
    },
    staleTime: 30000,
  });

  const handleAddToLeads = async (lead) => {
    try {
      // Create lead in DB
      await base44.asServiceRole.entities.Lead.create({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: 'Claude Code',
        lead_type: lead.keywords,
        notes: lead.keywords,
        source_post_url: lead.url,
      });
      
      // Mark as sent in sheet
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
      const sheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
      const range = encodeURIComponent(`'Claude Code'!J${lead.idx + 2}`);
      
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['כן']] }),
        }
      );
      
      refetch();
    } catch (err) {
      console.error('Failed to add lead:', err);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-blue-300">
        <CardContent className="p-6 text-center text-slate-500">טוען...</CardContent>
      </Card>
    );
  }

  const unsentLeads = leads.filter(l => !l.sent);

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          💼 Claude Code - לידים מ-LinkedIn
          <span className="text-sm font-normal text-blue-600 ml-auto">({unsentLeads.length} חדשים)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unsentLeads.length === 0 ? (
          <p className="text-slate-500 text-center py-6">אין לידים חדשים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-200">
                  <th className="text-right py-3 px-3 font-semibold text-blue-900">שם</th>
                  <th className="text-right py-3 px-3 font-semibold text-blue-900">טלפון</th>
                  <th className="text-right py-3 px-3 font-semibold text-blue-900">מייל</th>
                  <th className="text-right py-3 px-3 font-semibold text-blue-900">תחום עניין</th>
                  <th className="text-center py-3 px-3 font-semibold text-blue-900">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {unsentLeads.map((lead) => (
                  <tr key={lead.idx} className="border-b border-blue-100 hover:bg-blue-100/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900">{lead.name}</td>
                    <td className="py-3 px-3 text-slate-600">{lead.phone}</td>
                    <td className="py-3 px-3 text-slate-600 truncate">{lead.email}</td>
                    <td className="py-3 px-3 text-slate-600 text-xs">{lead.keywords}</td>
                    <td className="py-3 px-3 text-center flex items-center justify-center gap-2">
                      {lead.url && (
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-blue-200 rounded text-blue-600 transition-colors"
                          title="פתח בקישור"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
                        onClick={() => handleAddToLeads(lead)}
                      >
                        <Plus className="w-3 h-3 ml-1" />
                        הוסף
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}