import React from 'react';
import { MessageCircle, Mail, Phone, Instagram, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeIsraeliPhone, getIsraeliWhatsAppPhone } from '@/utils/leadDisplay';

// Friendly greeting that handles missing/placeholder names gracefully
function greet(name) {
  if (!name) return 'היי 👋';
  const clean = String(name).trim();
  if (!clean || /ללא שם|לא ידוע|unknown/i.test(clean)) return 'היי 👋';
  return `היי ${clean}`;
}

// Detects whether the lead has a real name we can address them by
function hasRealName(name) {
  if (!name) return false;
  const clean = String(name).trim();
  return clean && !/ללא שם|לא ידוע|unknown/i.test(clean);
}

// Personalized line based on shooting type
function typeContext(type) {
  if (!type) return 'שירותי צילום';
  const t = String(type).toLowerCase();
  if (t.includes('קורס')) return 'קורס הצילום';
  if (t.includes('שירותי צילום')) return 'שירותי צילום';
  return type;
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
      return `${greet(name)}, מה קורה? ראיתי שהשארת פרטים לגבי ${ctx}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`;
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
  // For unknown / unsaved contacts use a generic neutral opener instead of a personalized template
  const leadType = lead.lead_type || lead.interest_label || lead.shooting_type || 'שירותי צילום';
  const waText = hasRealName(lead.name)
    ? TEMPLATES.whatsapp.default(lead.name, leadType)
    : `היי, מה קורה? ראיתי שהשארת פרטים לגבי ${typeContext(leadType)}, אשמח לדבר ולתת עוד פרטים. מה אומר/ת?`;
  const displayPhone = normalizeIsraeliPhone(lead.phone);
  const israelPhone = getIsraeliWhatsAppPhone(lead.phone);
  const waLink = `https://wa.me/${israelPhone}?text=${encodeURIComponent(waText)}`;

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
        <a href={`tel:${displayPhone}`} onClick={(e) => { e.stopPropagation(); onLog?.('log_call', lead); }} className="flex-1">
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