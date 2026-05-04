import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2, ExternalLink, Cake, Users, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Newsletter() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('subscribers');

  const { data: subscribers = [] } = useQuery({
    queryKey: ['newsletterSubscribers'],
    queryFn: () => base44.entities.NewsletterSubscriber.list('-created_date', 500),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contactsForBirthdays'],
    queryFn: () => base44.entities.Contact.filter({ type: 'client' }, '-created_date', 500),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id) => base44.entities.NewsletterSubscriber.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletterSubscribers'] });
      toast.success('הנמען הוסר');
    }
  });

  const triggerBirthdayRun = async () => {
    try {
      toast.loading('מפעיל ברכות יום הולדת...', { id: 'bday' });
      const res = await base44.functions.invoke('runBirthdayGreetings', {});
      const d = res.data;
      toast.success(
        `הסתיים: ${d.birthdays_today || 0} ימי הולדת, ${d.emails_sent || 0} מיילים, ${d.whatsapp_tasks_created || 0} משימות וואטסאפ`,
        { id: 'bday', duration: 5000 }
      );
    } catch (err) {
      toast.error('שגיאה: ' + err.message, { id: 'bday' });
    }
  };

  const COURSE_LANDING_URL = 'https://natigold.com/photography-course/';

  const copyLandingLink = () => {
    navigator.clipboard.writeText(COURSE_LANDING_URL);
    toast.success('הקישור הועתק');
  };

  const active = subscribers.filter(s => s.status === 'active');
  const unsubscribed = subscribers.filter(s => s.status === 'unsubscribed');
  const clientsWithBirthday = contacts.filter(c => c.birthday);
  const clientsWithConsent = clientsWithBirthday.filter(c => c.birthday_greeting_consent);

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ניוזלטר וברכות</h1>
          <p className="text-sm text-slate-500 mt-1">ניהול רשימת תפוצה + ברכות יום הולדת אוטומטיות</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={copyLandingLink} variant="outline" className="border-slate-300 text-slate-700">
            <Copy className="w-4 h-4 ml-2" />
            העתק קישור לדף נחיתה
          </Button>
          <a
            href={COURSE_LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium border border-slate-200 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            פתח דף נחיתה
          </a>
          <Button onClick={triggerBirthdayRun} className="bg-pink-500 hover:bg-pink-600 text-white">
            <Cake className="w-4 h-4 ml-2" />
            הרץ ברכות עכשיו
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="נרשמים פעילים" value={active.length} color="emerald" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="הוסרו" value={unsubscribed.length} color="slate" />
        <StatCard icon={<Cake className="w-5 h-5" />} label="לקוחות עם תאריך לידה" value={clientsWithBirthday.length} color="pink" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="עם הסכמה לברכות" value={clientsWithConsent.length} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <TabBtn active={tab === 'subscribers'} onClick={() => setTab('subscribers')}>
          נרשמי ניוזלטר ({active.length})
        </TabBtn>
        <TabBtn active={tab === 'birthdays'} onClick={() => setTab('birthdays')}>
          ימי הולדת ({clientsWithBirthday.length})
        </TabBtn>
      </div>

      {tab === 'subscribers' && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              נרשמי רשימת תפוצה
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">שם</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">אימייל</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">מקור</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">הסכמה</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">סטטוס</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400">אין נרשמים עדיין</td></tr>
                  ) : subscribers.map(sub => (
                    <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{sub.full_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-600" dir="ltr">{sub.email}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {{
                          course_landing: 'דף נחיתה לקורס',
                          client_existing: 'לקוח קיים',
                          manual: 'ידני',
                          lead_form: 'טופס ליד'
                        }[sub.source] || sub.source}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {sub.consent_timestamp ? format(new Date(sub.consent_timestamp), 'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {sub.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> פעיל
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            הוסר
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => { if (confirm('למחוק נמען זה?')) deleteSubMutation.mutate(sub.id); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'birthdays' && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="w-4 h-4 text-pink-500" />
              לקוחות עם תאריך יום הולדת
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              עריכת תאריך יום הולדת + הסכמה לברכות נעשית מתוך כרטיס איש הקשר.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">שם</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">תאריך לידה</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">טלפון</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">אימייל</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">הסכמה</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">ברכה אחרונה</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithBirthday.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400">אין לקוחות עם תאריך לידה. הוסף תאריך לידה דרך כרטיס איש הקשר.</td></tr>
                  ) : clientsWithBirthday.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-600">{format(new Date(c.birthday), 'dd/MM')}</td>
                      <td className="py-3 px-4 text-slate-600" dir="ltr">{c.phone || '—'}</td>
                      <td className="py-3 px-4 text-slate-600" dir="ltr">{c.email || '—'}</td>
                      <td className="py-3 px-4">
                        {c.birthday_greeting_consent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> מאושר
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                            לא אושר
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {c.last_birthday_greeting_year || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    pink: 'bg-pink-50 text-pink-600 border-pink-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${colors[color]} mb-2`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[#C5A028] text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}