import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, FileText, Loader2, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SignaturePad from '@/components/quotes/SignaturePad';

export default function QuoteView() {
  const [quote, setQuote] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const [showSignFlow, setShowSignFlow] = useState(false);
  const [signature, setSignature] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signError, setSignError] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('לינק לא תקין');
      setLoading(false);
      return;
    }
    loadQuote();
  }, [token]);

  const loadQuote = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('acceptQuote', { token });
    if (res.data?.quote) {
      setQuote(res.data.quote);
      setSignerName(res.data.quote.client_name || '');
      const allSettings = await base44.entities.PhotographerSettings.list().catch(() => []);
      if (allSettings[0]) setSettings(allSettings[0]);
    } else {
      setError(res.data?.error || 'הצעת מחיר לא נמצאה');
    }
    setLoading(false);
  };

  const handleReject = async () => {
    setActing(true);
    const res = await base44.functions.invoke('acceptQuote', { token, action: 'reject' });
    if (res.data?.success) {
      setQuote({ ...quote, status: res.data.status });
    }
    setActing(false);
  };

  const handleConfirmSign = async () => {
    setSignError('');
    if (!signerName.trim()) {
      setSignError('נא להזין שם מלא');
      return;
    }
    if (!signature) {
      setSignError('נא לחתום בתיבת החתימה');
      return;
    }
    setActing(true);
    const res = await base44.functions.invoke('acceptQuote', {
      token,
      action: 'accept',
      signature_data: signature,
      signer_name: signerName.trim(),
    });
    if (res.data?.success) {
      setQuote({
        ...quote,
        status: res.data.status,
        signature_data: signature,
        signer_name: signerName.trim(),
        signed_at: new Date().toISOString(),
      });
      setShowSignFlow(false);
    } else {
      setSignError(res.data?.error || 'שגיאה באישור ההצעה');
    }
    setActing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#C5A028]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAccepted = quote.status === 'accepted';
  const isRejected = quote.status === 'rejected';
  const canAct = !isAccepted && !isRejected;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Branding Header */}
        <div className="text-center mb-8">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-slate-900">{settings?.business_name || 'הצעת מחיר'}</h1>
          {settings?.phone && <p className="text-sm text-slate-500 mt-1">{settings.phone}</p>}
        </div>

        {/* Status Banner */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3 justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <span className="font-bold text-green-700">הצעת המחיר אושרה ונחתמה!</span>
          </div>
        )}
        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3 justify-center">
            <XCircle className="w-6 h-6 text-red-500" />
            <span className="font-bold text-red-700">הצעת המחיר נדחתה</span>
          </div>
        )}

        {/* Quote Card */}
        <Card className="border rounded-2xl shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-slate-500">עבור</p>
                <h2 className="text-xl font-bold text-slate-900">{quote.client_name}</h2>
                {quote.client_email && <p className="text-sm text-slate-500">{quote.client_email}</p>}
              </div>
              <Badge className="bg-[#C5A028]/10 text-[#C5A028] font-bold">
                <FileText className="w-3.5 h-3.5 ml-1" />
                הצעת מחיר
              </Badge>
            </div>

            {quote.package_name && (
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-slate-800 mb-1">{quote.package_name}</h3>
                {quote.package_description && (
                  <p className="text-sm text-slate-600 whitespace-pre-line">{quote.package_description}</p>
                )}
              </div>
            )}

            {quote.items?.length > 0 && (
              <div className="mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-right py-2 text-slate-500 font-medium">פריט</th>
                      <th className="text-center py-2 text-slate-500 font-medium w-16">כמות</th>
                      <th className="text-left py-2 text-slate-500 font-medium w-24">מחיר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-3 text-slate-800">{item.description}</td>
                        <td className="py-3 text-center text-slate-600">{item.quantity}</td>
                        <td className="py-3 text-left font-medium text-slate-800">₪{(item.quantity * item.price).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between py-4 border-t-2 border-slate-200">
              <span className="text-lg font-bold text-slate-700">סה"כ</span>
              <span className="text-3xl font-extrabold text-[#C5A028]">₪{(quote.total_price || 0).toLocaleString()}</span>
            </div>

            {quote.valid_until && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-3">
                <Clock className="w-4 h-4" />
                <span>בתוקף עד: {new Date(quote.valid_until).toLocaleDateString('he-IL')}</span>
              </div>
            )}

            {quote.terms && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-bold mb-1">תנאים</p>
                <p className="text-xs text-slate-500 whitespace-pre-line">{quote.terms}</p>
              </div>
            )}

            {/* Signature display when accepted */}
            {isAccepted && quote.signature_data && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-bold text-slate-700">חתימה דיגיטלית מאושרת</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <img src={quote.signature_data} alt="חתימה" className="max-h-24 mx-auto" />
                  <div className="text-xs text-slate-500 text-center mt-2 space-y-0.5">
                    <p><strong>{quote.signer_name}</strong></p>
                    {quote.signed_at && <p>נחתם בתאריך: {new Date(quote.signed_at).toLocaleString('he-IL')}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {canAct && !showSignFlow && (
          <div className="flex gap-3">
            <Button
              onClick={() => setShowSignFlow(true)}
              disabled={acting}
              className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg"
            >
              <CheckCircle2 className="w-5 h-5 ml-2" />
              חתום ואשר את ההצעה
            </Button>
            <Button
              onClick={handleReject}
              disabled={acting}
              variant="outline"
              className="h-14 px-6 text-red-500 border-red-200 hover:bg-red-50 rounded-xl"
            >
              <XCircle className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Signature Flow */}
        {canAct && showSignFlow && (
          <Card className="border-2 border-green-200 rounded-2xl shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-slate-900">חתימה ואישור הצעת מחיר</h3>
              </div>
              <p className="text-sm text-slate-600">
                בחתימה דיגיטלית זו אני מאשר/ת את הצעת המחיר ומסכים/ה לתנאים המפורטים בה.
              </p>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם החותם *</label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="שם מלא"
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">חתימה *</label>
                <SignaturePad onChange={setSignature} />
              </div>

              {signError && (
                <p className="text-sm text-red-500 text-center">{signError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleConfirmSign}
                  disabled={acting}
                  className="flex-1 h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl"
                >
                  {acting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 ml-2" /> אשר חתימה</>}
                </Button>
                <Button
                  onClick={() => setShowSignFlow(false)}
                  disabled={acting}
                  variant="outline"
                  className="h-12"
                >
                  ביטול
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        {settings?.quote_footer_text && (
          <p className="text-center text-sm text-slate-400 mt-8">{settings.quote_footer_text}</p>
        )}
      </div>
    </div>
  );
}