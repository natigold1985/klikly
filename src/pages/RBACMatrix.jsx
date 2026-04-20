import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Check, X, Minus, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ROLES = [
  { key: 'admin', label: 'מנהל מערכת', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'photographer', label: 'צלם', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'user', label: 'משתמש רגיל', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { key: 'client', label: 'לקוח', color: 'bg-green-100 text-green-800 border-green-300' },
];

// true = full access, 'own' = own data only, false = no access, 'view' = read-only
const MATRIX = [
  {
    section: 'דפים וניווט',
    permissions: [
      { resource: 'לוח ניהול (Dashboard)', admin: true, photographer: true, user: true, client: false, note: 'לקוח מופנה לאחסון קבצים' },
      { resource: 'ניהול לידים', admin: true, photographer: true, user: true, client: false },
      { resource: 'ייבוא לידים', admin: true, photographer: true, user: true, client: false },
      { resource: 'אנשי קשר', admin: true, photographer: true, user: true, client: false },
      { resource: 'הצעות מחיר', admin: true, photographer: true, user: true, client: false },
      { resource: 'פרויקטים', admin: true, photographer: true, user: true, client: false },
      { resource: 'ספקי משנה', admin: true, photographer: true, user: true, client: false },
      { resource: 'אחסון קבצים', admin: true, photographer: true, user: true, client: 'own', note: 'לקוח רואה רק קבצים של הפרויקטים שלו' },
      { resource: 'משימות', admin: true, photographer: true, user: true, client: false },
      { resource: 'אנליטיקס', admin: true, photographer: true, user: true, client: false },
      { resource: 'ניהול משתמשים', admin: true, photographer: false, user: false, client: false, note: 'עמוד Admin בלבד' },
      { resource: 'הגדרות', admin: true, photographer: true, user: true, client: false },
    ]
  },
  {
    section: 'ישויות נתונים (Entities)',
    permissions: [
      { resource: 'Lead – יצירה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Lead – צפייה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Lead – עריכה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Lead – מחיקה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Project – יצירה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Project – צפייה', admin: true, photographer: true, user: true, client: 'own', note: 'לקוח רואה רק פרויקטים המשויכים אליו' },
      { resource: 'Project – עריכה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Photo – העלאה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Photo – בחירת תמונות (גלריה)', admin: true, photographer: true, user: false, client: 'own', note: 'לקוח בוחר תמונות בגלריה המוגנת ב-PIN' },
      { resource: 'Quote – יצירה ושליחה', admin: true, photographer: true, user: true, client: false },
      { resource: 'Quote – צפייה (קישור ציבורי)', admin: true, photographer: true, user: true, client: 'view', note: 'לקוח רואה דרך לינק ייחודי עם טוקן' },
      { resource: 'Contact – CRUD', admin: true, photographer: true, user: true, client: false },
      { resource: 'SubVendor – CRUD', admin: true, photographer: true, user: true, client: false },
      { resource: 'VendorAssignment – CRUD', admin: true, photographer: true, user: true, client: false },
      { resource: 'Task – CRUD', admin: true, photographer: true, user: true, client: false },
      { resource: 'Reminder – CRUD', admin: true, photographer: true, user: true, client: false },
      { resource: 'DeliveryLink – יצירה', admin: true, photographer: true, user: true, client: false },
      { resource: 'DeliveryLink – הורדה (קישור ציבורי)', admin: true, photographer: true, user: true, client: true, note: 'כולם יכולים דרך טוקן ייחודי' },
      { resource: 'PhotographerSettings', admin: true, photographer: true, user: false, client: false },
      { resource: 'SystemLog – צפייה', admin: true, photographer: false, user: false, client: false },
      { resource: 'Activity – צפייה', admin: true, photographer: true, user: true, client: false },
      { resource: 'User – רשימת כל המשתמשים', admin: true, photographer: false, user: false, client: false, note: 'דרך getAllUsers backend function' },
    ]
  },
  {
    section: 'פעולות מערכת',
    permissions: [
      { resource: 'ייבוא מ-Google Sheets', admin: true, photographer: true, user: true, client: false },
      { resource: 'ייבוא מ-CSV / Excel', admin: true, photographer: true, user: true, client: false },
      { resource: 'סנכרון Airtable', admin: true, photographer: true, user: true, client: false },
      { resource: 'שליחת WhatsApp (בודד)', admin: true, photographer: true, user: true, client: false },
      { resource: 'שידור WhatsApp (Broadcast)', admin: true, photographer: true, user: false, client: false, note: 'פעולת המונים – צלם ומנהל בלבד' },
      { resource: 'שליחת הצעת מחיר במייל', admin: true, photographer: true, user: true, client: false },
      { resource: 'יצירת קישור הורדה', admin: true, photographer: true, user: true, client: false },
      { resource: 'העלאת קבצים ל-BunnyCDN', admin: true, photographer: true, user: true, client: false },
      { resource: 'Google Calendar Sync', admin: true, photographer: true, user: true, client: false },
    ]
  },
  {
    section: 'אבטחה',
    permissions: [
      { resource: 'גישה לעמודים מוגנים (ניסיון)', admin: true, photographer: true, user: true, client: false, note: 'ניסיון גישה של לקוח מתועד כ-Security Incident' },
      { resource: 'צפייה בלוגים אבטחתיים', admin: true, photographer: false, user: false, client: false },
      { resource: 'הזמנת משתמשים חדשים', admin: true, photographer: false, user: false, client: false },
      { resource: 'גלריית לקוח (PIN)', admin: true, photographer: true, user: false, client: 'own', note: 'לקוח ניגש עם קוד PIN ייחודי לפרויקט' },
    ]
  },
];

function PermissionCell({ value, note }) {
  const cell = value === true
    ? <div className="flex items-center justify-center"><Check className="w-4 h-4 text-green-600" /></div>
    : value === false
    ? <div className="flex items-center justify-center"><X className="w-4 h-4 text-red-400" /></div>
    : value === 'own'
    ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 px-1.5 py-0">עצמי</Badge>
    : <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300 px-1.5 py-0">צפייה</Badge>;

  if (!note) return <td className="px-3 py-2 text-center border-b border-slate-100">{cell}</td>;

  return (
    <td className="px-3 py-2 text-center border-b border-slate-100">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 cursor-help">
              {cell}
              <Info className="w-3 h-3 text-slate-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs text-right" dir="rtl">
            {note}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </td>
  );
}

export default function RBACMatrix() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-800">גישה נדחתה</h2>
          <p className="text-slate-500">עמוד זה זמין למנהלי מערכת בלבד.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">מטריצת הרשאות (RBAC)</h1>
        <p className="text-slate-400 text-sm mt-0.5">מיפוי מלא של הרשאות לפי תפקיד במערכת</p>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <Badge key={r.key} className={`${r.color} border font-bold text-xs`}>{r.label}</Badge>
        ))}
        <div className="flex items-center gap-3 mr-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> גישה מלאה</span>
          <span className="inline-flex items-center gap-1"><X className="w-3.5 h-3.5 text-red-400" /> חסום</span>
          <span className="inline-flex items-center gap-1"><Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-300 px-1 py-0">עצמי</Badge> נתונים עצמיים</span>
          <span className="inline-flex items-center gap-1"><Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-300 px-1 py-0">צפייה</Badge> קריאה בלבד</span>
        </div>
      </div>

      {/* Matrix Tables */}
      {MATRIX.map((section) => (
        <Card key={section.section} className="border shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b">
            <CardTitle className="text-sm font-bold text-slate-700">{section.section}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-500 border-b border-slate-200 w-[40%]">משאב / פעולה</th>
                    {ROLES.map(r => (
                      <th key={r.key} className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 border-b border-slate-200 w-[15%]">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.permissions.map((perm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2 text-right text-slate-700 font-medium border-b border-slate-100 text-xs">
                        {perm.resource}
                      </td>
                      {ROLES.map(r => (
                        <PermissionCell key={r.key} value={perm[r.key]} note={perm[r.key] !== true && perm[r.key] !== false ? perm.note : (perm.note && perm[r.key] === false && r.key === 'client' ? perm.note : null)} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}