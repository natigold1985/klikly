import React from 'react';
import { MessageCircle, Mail, Phone, Instagram, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TEMPLATES = {
  whatsapp: {
    facebook: (name, type) => `היי ${name}, ראיתי שפנית אלינו דרך פייסבוק בנושא ${type || 'צילום'}. אשמח לשמוע עוד ולשלוח לך הצעת מחיר 📸`,
    instagram: (name, type) => `היי ${name} 👋 תודה שפנית דרך אינסטגרם! אשמח לדבר על ${type || 'הצילום'} שמעניין אותך`,
    google: (name, type) => `היי ${name}, קיבלתי את הפנייה שלך. אשמח לעזור עם ${type || 'צילום'}. מתי נוח לשיחה קצרה?`,
    linkedin: (name, type) => `היי ${name}, ראיתי את הפנייה שלך דרך LinkedIn בנוגע ל${type || 'צילום'}. אשמח לדבר ולשלוח הצעה מותאמת 📷`,
    default: (name, type) => `היי ${name}, קיבלתי את הפנייה שלך בנוגע ל${type || 'צילום'}. אשמח לחזור אליך עם פרטים נוספים 📸`,
  },
  email: {
    subject: (name) => `תודה על פנייתך, ${name}!`,
    body: (name, type) => `שלום ${name},\n\nתודה שפנית אלינו בנוגע ל${type || 'צילום'}.\nאשמח לקבוע שיחה קצרה כדי להבין את הצרכים שלך ולשלוח הצעת מחיר מותאמת.\n\nבברכה`,
  },
};

function getSourceKey(source) {
  if (!source) return 'default';
  const lower = source.toLowerCase();
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