import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Cake, CheckCircle2, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ClientNewsletter() {
  const queryClient = useQueryClient();
  const [birthday, setBirthday] = useState('');
  const [bdayConsent, setBdayConsent] = useState(false);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['clientNewsletterPrefs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('clientNewsletterPrefs', { action: 'get' });
      return res.data;
    },
  });

  useEffect(() => {
    if (prefs) {
      setBirthday(prefs.birthday || '');
      setBdayConsent(!!prefs.birthday_greeting_consent);
    }
  }, [prefs]);

  const mutate = useMutation({
    mutationFn: (payload) => base44.functions.invoke('clientNewsletterPrefs', payload),
    onSuccess: (res) => {
      queryClient.setQueryData(['clientNewsletterPrefs'], res.data);
    },
  });

  const handleSubscribe = async () => {
    await mutate.mutateAsync({ action: 'subscribe' });
    toast.success('נרשמת בהצלחה לעדכונים 🎉');
  };

  const handleUnsubscribe = async () => {
    await mutate.mutateAsync({ action: 'unsubscribe' });
    toast.success('הוסרת מרשימת התפוצה');
  };

  const handleSaveBirthday = async () => {
    await mutate.mutateAsync({
      action: 'update_birthday',
      birthday: birthday || null,
      birthday_greeting_consent: bdayConsent,
    });
    toast.success('הפרטים נשמרו');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20" dir="rtl">
      <div className="text-center pt-2">
        <h1 className="text-2xl font-bold text-slate-900">ניוזלטר וברכות</h1>
        <p className="text-sm text-slate-500 mt-1">נהל את ההרשמה לעדכונים ואת התאריכים החשובים שלך</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Newsletter subscription card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">רשימת התפוצה</h2>
                <p className="text-xs text-slate-500">{prefs?.email}</p>
              </div>
            </div>

            {prefs?.subscribed ? (
              <>
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  אתה רשום ומקבל עדכונים והטבות
                </div>
                <Button
                  onClick={handleUnsubscribe}
                  disabled={mutate.isPending}
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700"
                >
                  <BellOff className="w-4 h-4 ml-2" />
                  הסר אותי מהרשימה
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  הירשם כדי לקבל עדכונים, טיפים והטבות ישירות למייל.
                </p>
                <Button
                  onClick={handleSubscribe}
                  disabled={mutate.isPending}
                  className="w-full"
                >
                  <Bell className="w-4 h-4 ml-2" />
                  הרשמה לעדכונים
                </Button>
              </>
            )}
          </div>

          {/* Birthday card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center border border-pink-100">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">יום ההולדת שלי</h2>
                <p className="text-xs text-slate-500">כדי שנוכל לפנק אותך בברכה ביום המיוחד</p>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-1.5">תאריך לידה</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-4"
            />

            <label className="flex items-start gap-3 cursor-pointer mb-5 select-none">
              <input
                type="checkbox"
                checked={bdayConsent}
                onChange={(e) => setBdayConsent(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-pink-500"
              />
              <span className="text-sm text-slate-600">
                אני מאשר/ת קבלת ברכת יום הולדת ב-WhatsApp / אימייל
              </span>
            </label>

            <Button
              onClick={handleSaveBirthday}
              disabled={mutate.isPending}
              className="w-full"
            >
              <CheckCircle2 className="w-4 h-4 ml-2" />
              שמירה
            </Button>
          </div>
        </>
      )}
    </div>
  );
}