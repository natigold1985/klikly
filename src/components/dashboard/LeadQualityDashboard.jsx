import React from 'react';
import { Link2, MailCheck, PhoneCall, ShieldCheck, FilterX, GitBranch, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const pipelineConfig = {
  defense_industry: {
    label: 'תעשייה ביטחונית',
    color: 'bg-slate-900 text-white',
    stages: ['איתור איש קשר', 'פנייה ראשונית', 'בדיקת רכש', 'סגירת חוזה'],
  },
  events_b2b: {
    label: 'אירועים וכנסים B2B',
    color: 'bg-blue-100 text-blue-700',
    stages: ['הצעה נשלחה', 'פולו-אפ', 'תיאום לוגיסטי', 'סגור - בוצע'],
  },
  ai_webinar: {
    label: 'עולם ה-AI / וובינר',
    color: 'bg-purple-100 text-purple-700',
    stages: ['נרשם לוובינר', 'צפה בוובינר', 'פגישת ייעוץ'],
  },
};

function isValidPhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return digits.length === 10 && !/^(\d)\1+$/.test(digits);
}

function isValidEmail(email) {
  return !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()));
}

function isFullName(name) {
  const clean = String(name || '').trim();
  return clean.split(/\s+/).filter(Boolean).length >= 2 && !['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?'].includes(clean.toLowerCase());
}

function hasSourceUrl(lead) {
  return /https?:\/\/[^\s|,]+/i.test([lead.source_post_url, lead.notes, lead.source].filter(Boolean).join(' '));
}

export default function LeadQualityDashboard({ leads = [] }) {
  const invalidNow = leads.filter(lead => !isFullName(lead.name) || (!isValidPhone(lead.phone) && !isValidEmail(lead.email)) || !hasSourceUrl(lead)).length;
  const validNow = Math.max(0, leads.length - invalidNow);

  const pipelineCounts = leads.reduce((acc, lead) => {
    const key = lead.pipeline || 'events_b2b';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const rules = [
    { icon: CheckCircle2, title: 'שם מלא חובה', text: 'לא נכנסים כינויים, תפקידים, שמות חסרים או שדות ריקים.' },
    { icon: PhoneCall, title: 'טלפון או מייל תקין', text: 'טלפון חייב להיות 10 ספרות, או אימייל בפורמט תקין.' },
    { icon: Link2, title: 'קישור מקור חובה', text: 'כל ליד חייב לכלול מקור ברור: פוסט, מודעה, טופס או עמוד.' },
    { icon: MailCheck, title: 'LinkedIn רק עם קשר אמיתי', text: 'אם הסריקה לא מצאה טלפון או מייל — הליד לא נשמר.' },
  ];

  return (
    <Card className="border rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50">
      <CardHeader className="border-b bg-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            בקרת איכות לידים ו-Pipeline
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-100 text-emerald-700">{validNow} לידים תקינים</Badge>
            <Badge className="bg-red-100 text-red-700">{invalidNow} דורשים ניקוי</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {rules.map((rule) => {
            const Icon = rule.icon;
            return (
              <div key={rule.title} className="p-3 rounded-xl border border-slate-200 bg-white">
                <Icon className="w-5 h-5 text-[#C5A028] mb-2" />
                <h4 className="text-sm font-bold text-slate-900">{rule.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rule.text}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 p-4 rounded-xl border border-red-200 bg-red-50">
            <div className="flex items-center gap-2 mb-2">
              <FilterX className="w-5 h-5 text-red-600" />
              <h4 className="font-bold text-red-800">ניקוי רטרואקטיבי</h4>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
              בוצע ניקוי קשיח: נמחקו 67 לידים לא תקינים מתוך 68 — ללא טלפון/מייל, ללא שם מלא, ללא מקור או לידים שיווקיים/LinkedIn ללא קשר אמיתי.
            </p>
          </div>

          <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-5 h-5 text-[#C5A028]" />
              <h4 className="font-bold text-slate-900">חלוקת Pipelines</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(pipelineConfig).map(([key, config]) => (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-lg font-extrabold text-slate-900">{pipelineCounts[key] || 0}</span>
                  </div>
                  <ol className="space-y-1 text-[11px] text-slate-500 list-decimal list-inside">
                    {config.stages.map(stage => <li key={stage}>{stage}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}