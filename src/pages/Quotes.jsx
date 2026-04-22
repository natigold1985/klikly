import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Send, Plus, Search, Trash2, Edit, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import QuoteEditor from '@/components/quotes/QuoteEditor';

const STATUS_MAP = {
  draft: { label: 'טיוטה', color: 'bg-slate-100 text-slate-600' },
  sent: { label: 'נשלח', color: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'נצפה', color: 'bg-purple-100 text-purple-700' },
  accepted: { label: 'אושר', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'נדחה', color: 'bg-red-100 text-red-700' },
};

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
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
    mutationFn: (data) => base44.entities.Quote.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowEditor(false);
      setEditingQuote(null);
      toast.success('הצעת מחיר נוצרה');
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Quote.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowEditor(false);
      setEditingQuote(null);
      toast.success('הצעת המחיר עודכנה');
    },
  });

  const handleSave = (formData) => {
    if (editingQuote) {
      updateQuoteMutation.mutate({ id: editingQuote.id, data: { ...formData, status: editingQuote.status } });
    } else {
      createQuoteMutation.mutate({ ...formData, status: 'draft' });
    }
  };

  const handleSendWhatsApp = (quote) => {
    const itemsList = quote.items?.map(i => `• ${i.description} — ₪${i.price * i.quantity}`).join('\n') || '';
    const text = `היי ${quote.client_name},\n\nמצורפת הצעת המחיר:\n${quote.package_name ? `📦 ${quote.package_name}\n` : ''}${itemsList ? `\n${itemsList}\n` : ''}\n💰 סה"כ: ₪${quote.total_price}\n\nבתוקף עד: ${quote.valid_until || 'לא הוגדר'}\n\nנשמח לענות על כל שאלה!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    base44.entities.Quote.update(quote.id, { status: 'sent' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    });
  };

  const handleSendEmail = (quote) => {
    const subject = `הצעת מחיר — ${quote.package_name || 'צילום'}`;
    const body = `שלום ${quote.client_name},\n\nמצורפת הצעת המחיר עבור ${quote.package_name || 'שירותי צילום'}.\nסה"כ: ₪${quote.total_price}\n\nבברכה`;
    window.open(`mailto:${quote.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    base44.entities.Quote.update(quote.id, { status: 'sent' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    });
  };

  const filteredQuotes = quotes.filter(q =>
    (q.client_name || '').includes(searchTerm) || (q.package_name || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">הצעות מחיר</h1>
          <p className="text-slate-500 text-sm mt-0.5">צור, ערוך ושלח הצעות מחיר ללקוחות</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingQuote(null); setShowEditor(true); }}>
          <Plus className="w-4 h-4" /> הצעה חדשה
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חיפוש לפי שם לקוח או חבילה..." className="pr-10 h-9" />
      </div>

      <Dialog open={showEditor} onOpenChange={(open) => { if (!open) { setShowEditor(false); setEditingQuote(null); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingQuote ? 'עריכת הצעת מחיר' : 'הצעת מחיר חדשה'}</DialogTitle>
          </DialogHeader>
          <QuoteEditor quote={editingQuote} onSave={handleSave} onCancel={() => { setShowEditor(false); setEditingQuote(null); }} />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">אין הצעות מחיר עדיין</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setEditingQuote(null); setShowEditor(true); }}>
              <Plus className="w-4 h-4" /> צור הצעה ראשונה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map(quote => {
            const status = STATUS_MAP[quote.status] || STATUS_MAP.draft;
            return (
              <Card key={quote.id} className="border hover:border-[#C5A028]/40 hover:shadow-md transition-all rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 truncate">{quote.client_name}</h3>
                      <p className="text-xs text-slate-500 truncate">{quote.package_name || 'ללא חבילה'}</p>
                    </div>
                    <Badge className={`${status.color} text-[10px] font-bold shrink-0`}>{status.label}</Badge>
                  </div>

                  {quote.items?.length > 0 && (
                    <div className="space-y-1 mb-3 text-xs text-slate-500">
                      {quote.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="truncate flex-1">{item.description}</span>
                          <span className="font-medium text-slate-700 shrink-0 mr-2">₪{item.quantity * item.price}</span>
                        </div>
                      ))}
                      {quote.items.length > 3 && <p className="text-slate-400">+ {quote.items.length - 3} פריטים נוספים</p>}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">סה"כ</span>
                    <span className="text-xl font-extrabold text-[#C5A028]">₪{(quote.total_price || 0).toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-9 gap-1 bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={() => handleSendWhatsApp(quote)}>
                      <Send className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                    {quote.client_email && (
                      <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => handleSendEmail(quote)}>
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => { setEditingQuote(quote); setShowEditor(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm('למחוק?')) deleteQuoteMutation.mutate(quote.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}