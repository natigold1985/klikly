import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import QuoteEditor from '@/components/quotes/QuoteEditor';

const generateToken = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export default function SendQuoteFromLeadDialog({ lead, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [createdQuote, setCreatedQuote] = useState(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.Quote.create({
        ...data,
        lead_id: lead?.id,
        status: 'draft',
        access_token: generateToken(),
      }),
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setCreatedQuote(quote);
      toast.success('הצעת המחיר נוצרה');
    },
  });

  const quoteLink = createdQuote
    ? `${window.location.origin}/quote/view?token=${createdQuote.access_token}`
    : '';

  const markSent = async () => {
    if (createdQuote && createdQuote.status === 'draft') {
      await base44.entities.Quote.update(createdQuote.id, { status: 'sent' });
      // Update lead status to quote_sent
      if (lead?.id) {
        await base44.entities.Lead.update(lead.id, { status: 'quote_sent' });
      }
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead?.id] });
    }
  };

  const handleWhatsApp = async () => {
    await markSent();
    const itemsList = createdQuote.items
      ?.map((i) => `• ${i.description} — ₪${i.price * i.quantity}`)
      .join('\n') || '';
    const text = `היי ${createdQuote.client_name},\n\nמצורפת הצעת המחיר:\n${createdQuote.package_name ? `📦 ${createdQuote.package_name}\n` : ''}${itemsList ? `\n${itemsList}\n` : ''}\n💰 סה"כ: ₪${createdQuote.total_price}\n\nבתוקף עד: ${createdQuote.valid_until || 'לא הוגדר'}\n\n📋 לצפייה, חתימה ואישור:\n${quoteLink}\n\nנשמח לענות על כל שאלה!`;
    const phone = (lead?.phone || '').replace(/\D/g, '').replace(/^0/, '972');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleEmail = async () => {
    await markSent();
    const subject = `הצעת מחיר — ${createdQuote.package_name || 'צילום'}`;
    const body = `שלום ${createdQuote.client_name},\n\nמצורפת הצעת המחיר עבור ${createdQuote.package_name || 'שירותי צילום'}.\nסה"כ: ₪${createdQuote.total_price}\n\nלצפייה, חתימה ואישור:\n${quoteLink}\n\nבברכה`;
    window.open(
      `mailto:${createdQuote.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(quoteLink);
    setCopied(true);
    toast.success('הקישור הועתק');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCreatedQuote(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[640px] h-[85vh] sm:max-h-[90vh] w-[95vw] overflow-y-auto fixed bottom-0 sm:bottom-auto rounded-t-3xl sm:rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {createdQuote ? 'שלח את ההצעה ללקוח' : `הצעת מחיר עבור ${lead?.name || ''}`}
          </DialogTitle>
        </DialogHeader>

        {!createdQuote ? (
          <QuoteEditor
            lead={lead}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={handleClose}
          />
        ) : (
          <div className="space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-bold mb-1">ההצעה מוכנה לשליחה ✓</p>
              <p className="text-sm text-green-600">
                בעת חתימה דיגיטלית של הלקוח — הליד ייסגר אוטומטית וייווצר פרויקט חדש בלוח הניהול.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">קישור ייחודי לחתימה</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={quoteLink}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-mono"
                />
                <Button variant="outline" size="icon" onClick={handleCopy} title="העתק">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleWhatsApp}
                className="h-12 gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
              >
                <MessageCircle className="w-4 h-4" /> שלח בוואטסאפ
              </Button>
              {createdQuote.client_email && (
                <Button
                  onClick={handleEmail}
                  variant="outline"
                  className="h-12 gap-2"
                >
                  <Mail className="w-4 h-4" /> שלח באימייל
                </Button>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>סיום</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}