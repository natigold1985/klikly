import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Folder, Mail, Cake, CheckCircle2, Bell, BellOff, ChevronLeft, Sparkles } from 'lucide-react';

export default function ClientPortal() {
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
    <div className="max-w-4xl mx-auto pb-20" dir="rtl">
      <div className="mb-8 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-medium text-[#C5A028]">האזור האישי שלך</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">ברוכים הבאים</h1>
        <p className="text-slate-500 mt-1 text-sm">כאן תוכל לנהל את הקבצים, העדכונים וברכות יום ההולדת שלך</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#D4AF37] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1 — File Storage (navigation only) */}
          <Link to={createPageUrl('FileStorage')} className="group block">
            <Card className="h-full border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-[#FFD700] to-[#C5A028]" />
              <CardContent className="p-6 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#C5A028] flex items-center justify-center mb-4 shadow-sm">
                  <Folder className="w-6 h-6 text-black" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">הגלריות שלי</h2>
                <p className="text-sm text-slate-500 flex-1 mb-4">
                  גישה לכל הקבצים והתמונות שהצלם שלח אליך
                </p>
                <div className="flex items-center gap-1 text-[#C5A028] text-sm font-semibold group-hover:gap-2 transition-all">
                  לצפייה בקבצים
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2 — Newsletter (inline) */}
          <Card className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-amber-400 to-amber-500" />
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">ניוזלטר</h2>
              <p className="text-xs text-slate-500 mb-4">{prefs?.email}</p>

              {prefs?.subscribed ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-4">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    רשום ומקבל עדכונים
                  </div>
                  <Button
                    onClick={handleUnsubscribe}
                    disabled={mutate.isPending}
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-300 text-slate-700"
                  >
                    <BellOff className="w-4 h-4 ml-2" />
                    הסר מהרשימה
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    קבל עדכונים, טיפים והטבות ישירות למייל.
                  </p>
                  <Button
                    onClick={handleSubscribe}
                    disabled={mutate.isPending}
                    size="sm"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0"
                  >
                    <Bell className="w-4 h-4 ml-2" />
                    הרשמה לעדכונים
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 3 — Birthday Greetings (inline) */}
          <Card className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-pink-400 to-rose-400" />
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-4">
                <Cake className="w-6 h-6 text-pink-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">ברכות</h2>
              <p className="text-xs text-slate-500 mb-4">כדי שנוכל לפנק אותך ביום המיוחד</p>

              <label className="block text-sm font-medium text-slate-700 mb-1.5">תאריך לידה</label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-3 text-sm"
              />

              <label className="flex items-start gap-2 cursor-pointer mb-4 select-none">
                <input
                  type="checkbox"
                  checked={bdayConsent}
                  onChange={(e) => setBdayConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-pink-500"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  אני מאשר/ת קבלת ברכת יום הולדת ב-WhatsApp / אימייל
                </span>
              </label>

              <Button
                onClick={handleSaveBirthday}
                disabled={mutate.isPending}
                size="sm"
                className="w-full bg-pink-500 hover:bg-pink-600 text-white border-0"
              >
                <CheckCircle2 className="w-4 h-4 ml-2" />
                שמירה
              </Button>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
