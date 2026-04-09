import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Send, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    id: 'bronze',
    package_name: 'חבילת ארד',
    package_description: 'צילום אירוע עד 4 שעות, כ-300 תמונות ערוכות',
    total_price: 2500,
  },
  {
    id: 'headshot',
    package_name: 'מחירון צילומי תדמית',
    package_description: 'סשן צילומי תדמית בסטודיו, כולל 5 תמונות מרוטשות',
    total_price: 800,
  }
];

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.filter({}, '-created_date', 100),
    enabled: !!user,
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('הצעת המחיר נמחקה');
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: (newQuote) => base44.entities.Quote.create(newQuote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('הצעת מחיר נוצרה בהצלחה');
    },
  });

  const handleCreateFromTemplate = (template) => {
    createQuoteMutation.mutate({
      client_name: 'לקוח חדש',
      client_email: 'client@example.com',
      package_name: template.package_name,
      package_description: template.package_description,
      total_price: template.total_price,
      status: 'draft'
    });
  };

  const handleSendWhatsApp = (quote) => {
    const text = `היי ${quote.client_name}, מצורפת הצעת המחיר עבור ${quote.package_name}: סך הכל ${quote.total_price} ש"ח. לפרטים נוספים אנא השב להודעה זו.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    
    // Update status
    base44.entities.Quote.update(quote.id, { status: 'sent' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    });
  };

  const filteredQuotes = quotes.filter(q => q.client_name.includes(searchTerm) || q.package_name?.includes(searchTerm));

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#FFD700]">הצעות מחיר</h1>
          <p className="text-slate-400 mt-1">נהל ושלח הצעות מחיר מוכנות מראש</p>
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {TEMPLATES.map(template => (
          <Card key={template.id} className="bg-[#0a0a0a] border-slate-800 hover:border-[#FFD700]/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg text-white">{template.package_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">{template.package_description}</p>
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#FFD700]">₪{template.total_price}</span>
                <Button onClick={() => handleCreateFromTemplate(template)} size="sm" className="bg-[#FFD700] text-black hover:bg-[#e6c200]">
                  <Plus className="w-4 h-4 ml-2" /> צור מתבנית
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="חיפוש הצעות מחיר..."
          className="pr-10 bg-[#0a0a0a] border-slate-800 text-white"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuotes.map(quote => (
            <Card key={quote.id} className="bg-[#0a0a0a] border-slate-800">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white">{quote.client_name}</h3>
                    <p className="text-sm text-slate-400">{quote.package_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={quote.status === 'sent' ? 'default' : 'secondary'} className={quote.status === 'sent' ? 'bg-green-500/20 text-green-400 border-none' : 'bg-slate-800 text-slate-300 border-none'}>
                      {quote.status === 'sent' ? 'נשלח' : 'טיוטה'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteQuoteMutation.mutate(quote.id)} className="h-8 w-8 text-[#FFD700] hover:bg-[#FFD700]/20 hover:text-[#FFD700] -mt-1 -mr-1">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-[#FFD700]">₪{quote.total_price}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleSendWhatsApp(quote)}
                    className="flex-1 bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold h-11 rounded-xl"
                  >
                    <Send className="w-4 h-4 ml-2" /> שליחה ב-WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}