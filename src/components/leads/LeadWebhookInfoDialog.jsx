import React from 'react';
import { Copy, MessageCircle, Facebook } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const jsonExample = `{
  "phone": "0501234567",
  "first_name": "דנה",
  "full_name": "דנה כהן",
  "source": "Photography Course"
}`;

function copy(text, label) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} הועתק`);
}

export default function LeadWebhookInfoDialog({ open, onOpenChange }) {
  const webhookName = 'whatsappLeadsWebhook';
  const whatsappBusinessWebhook = 'whatsappBusinessWebhook';
  const facebookWebhook = 'metaLeadAdsWebhook';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-white text-slate-900" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Webhooks Native ללידים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-black text-emerald-900 mb-1">WhatsApp / JONI</p>
            <p className="text-emerald-800 mb-3">שלח POST לפונקציה <span className="font-mono font-bold">{webhookName}</span>. כל ליד ייכנס ישירות למסד המרכזי ויופיע בלוח הלידים הראשי.</p>
            <div className="flex items-center gap-2 rounded-xl bg-white border border-emerald-200 p-3" dir="ltr">
              <code className="flex-1 text-xs text-slate-700">Dashboard → Code → Functions → {webhookName} → Endpoint URL</code>
              <Button size="sm" variant="outline" className="text-slate-900 border-slate-200" onClick={() => copy(webhookName, 'שם הפונקציה')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-900 mb-2">מבנה JSON לשליחה</p>
            <pre className="rounded-xl bg-slate-950 text-emerald-300 p-4 text-xs overflow-x-auto" dir="ltr">{jsonExample}</pre>
            <Button size="sm" className="mt-3" onClick={() => copy(jsonExample, 'מבנה ה-JSON')}>
              <Copy className="w-4 h-4" /> העתק JSON
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-black text-blue-900 flex items-center gap-2"><Facebook className="w-4 h-4" /> Facebook Lead Ads</p>
              <p className="text-blue-800 mt-1">השתמש בפונקציה <span className="font-mono font-bold">{facebookWebhook}</span> ב-Meta Webhooks.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-black text-emerald-900 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp Business API</p>
              <p className="text-emerald-800 mt-1">השתמש בפונקציה <span className="font-mono font-bold">{whatsappBusinessWebhook}</span> ב-Meta Webhooks.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}