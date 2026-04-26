import React from 'react';
import { MessageCircle, Mail, Phone, Instagram, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Friendly greeting that handles missing/placeholder names gracefully
function greet(name) {
  if (!name) return 'היי 👋';
  const clean = String(name).trim();
  if (!clean || /ללא שם|לא ידוע|unknown/i.test(clean)) return 'היי 👋';
  return `היי ${clean}`;
}

// Personalized line based on shooting type
function typeContext(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes('חתונה')) return 'בנושא צילום החתונה שלך';
  if (t.includes('בר') || t.includes('בת מצווה')) return 'בנושא צילום בר/בת המצווה';
  if (t.includes('אירוע')) return 'בנושא צילום האירוע שלך';
  if (t.includes('היריון') || t.includes('הריון')) return 'בנושא צילומי הריון';
  if (t.includes('משפח')) return 'בנושא צילומי המשפחה';
  if (t.includes('עסק') || t.includes('מוצר') || t.includes('תדמית')) return 'בנושא צילומי תדמית/עסקים';
  if (t.includes('סטילס') || t.includes('סטודיו')) return 'בנושא צילומי הסטודיו';
  if (t.includes('דרושים') || t.includes('גיוס')) return null; // not a real lead
  return `בנושא ${type}`;
}

const TEMPLATES = {
  whatsapp: {
    natigold: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 🙏\nתודה רבה שפנית אליי דרך האתר natigold.com${ctx ? ` ${ctx}` : ''}.\nאשמח לשמוע עוד פרטים — תאריך, מיקום ומה חשוב לך — ולחזור אליך עם הצעה מותאמת 📸`;
    },
    facebook: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 👋\nראיתי את הפנייה שלך בפייסבוק${ctx ? ` ${ctx}` : ''}.\nאני נתי גולד, צלם מקצועי — אשמח לשמוע עוד ולשלוח הצעה מותאמת 📷`;
    },
    instagram: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 👋\nתודה שפנית באינסטגרם${ctx ? ` ${ctx}` : ''}.\nאשמח לשמוע יותר על מה שמעניין אותך ולחזור עם פרטים 📸`;
    },
    google: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 🙏\nקיבלתי את הפנייה שלך${ctx ? ` ${ctx}` : ''}.\nמתי נוח לך לשיחה קצרה כדי להבין מה אתה מחפש?`;
    },
    linkedin: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 👋\nראיתי את הפנייה שלך ב-LinkedIn${ctx ? ` ${ctx}` : ''}.\nאשמח לדבר ולשלוח הצעה מותאמת 📷`;
    },
    default: (name, type) => {
      const ctx = typeContext(type);
      return `${greet(name)} 🙏\nאני נתי גולד, צלם מקצועי. קיבלתי את הפנייה שלך${ctx ? ` ${ctx}` : ''}.\nאשמח לשמוע עוד פרטים ולחזור אליך עם הצעה מותאמת 📸\nאתר: natigold.com`;
    },
  },
  email: {
    subject: (name) => name && !/ללא שם|לא ידוע/i.test(name) ? `תודה על פנייתך, ${name}!` : 'תודה על פנייתך!',
    body: (name, type) => {
      const ctx = typeContext(type);
      const greeting = name && !/ללא שם|לא ידוע/i.test(name) ? `שלום ${name},` : 'שלום,';
      return `${greeting}\n\nתודה שפנית אליי${ctx ? ` ${ctx}` : ''}.\nאשמח לקבוע שיחה קצרה כדי להבין את הצרכים שלך ולשלוח הצעת מחיר מותאמת.\n\nבברכה,\nנתי גולד\nnatigold.com`;
    },
  },
};

function getSourceKey(source) {
  if (!source) return 'default';
  const lower = source.toLowerCase();
  if (lower.includes('natigold') || lower.includes('נתי גולד')) return 'natigold';
  if (lower.includes('facebook') || lower.includes('fb') || lower.includes('פייסבוק')) return 'facebook';
  if (lower.includes('instagram') || lower.includes('ig') || lower.includes('אינסטגרם')) return 'instagram';
  if (lower.includes('google') || lower.includes('sheets') || lower.includes('גוגל')) return 'google';
  if (lower.includes('linkedin') || lower.includes('לינקדאין')) return 'linkedin';
  return 'default';
}

export default function OutreachActions({ lead, onLog, compact = false }) {
  const sourceKey = getSourceKey(lead.source);
  const waText = TEMPLATES.whatsapp[sourceKey](lead.name, lead.shooting_type);
  const waLink = `https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waText)}`;

  const emailSubject = TEMPLATES.email.subject(lead.name);
  const emailBody = TEMPLATES.email.body(lead.name, lead.shooting_type);
  const mailtoLink = lead.email 
    ? `mailto:${lead.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` 
    : null;

  return (
    <div className={`flex flex-col gap-2 w-full ${compact ? '' : 'pt-4 border-t border-slate-100'}`}>
      {/* WhatsApp - Primary */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.stopPropagation(); onLog?.('log_whatsapp', lead); }}
        className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm px-4 py-2.5 h-11 transition-all font-bold rounded-xl w-full"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-bold">WhatsApp</span>
      </a>

      {/* Secondary Row */}
      <div className="flex gap-2 w-full">
        <a href={`tel:${lead.phone}`} onClick={(e) => { e.stopPropagation(); onLog?.('log_call', lead); }} className="flex-1">
          <Button variant="ghost" className="h-10 w-full rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 gap-1.5">
            <Phone className="w-4 h-4" />
            התקשר
          </Button>
        </a>

        {mailtoLink ? (
          <a href={mailtoLink} onClick={(e) => { e.stopPropagation(); onLog?.('log_manual', lead); }} className="flex-1">
            <Button variant="ghost" className="h-10 w-full rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 gap-1.5">
              <Mail className="w-4 h-4" />
              אימייל
            </Button>
          </a>
        ) : (
          <Button 
            variant="ghost" 
            className="h-10 flex-1 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 gap-1.5" 
            onClick={(e) => { e.stopPropagation(); onLog?.('log_manual', lead); }}
          >
            <Send className="w-4 h-4" />
            תיעוד
          </Button>
        )}
      </div>
    </div>
  );
}