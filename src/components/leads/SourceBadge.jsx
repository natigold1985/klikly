import React from 'react';
import { FileSpreadsheet, MessageCircle, Instagram, Facebook, Mail, Globe, User, Linkedin, Phone } from 'lucide-react';

// Source key → icon + label + brand color (background)
const SOURCE_CONFIG = {
  google:    { icon: Globe,           label: 'Google',    bg: '#4285F4', text: '#fff' },
  sheets:    { icon: FileSpreadsheet, label: 'Sheets',    bg: '#0F9D58', text: '#fff' },
  facebook:  { icon: Facebook,        label: 'Facebook',  bg: '#1877F2', text: '#fff' },
  fb:        { icon: Facebook,        label: 'Facebook',  bg: '#1877F2', text: '#fff' },
  instagram: { icon: Instagram,       label: 'Instagram', bg: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', text: '#fff' },
  ig:        { icon: Instagram,       label: 'Instagram', bg: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', text: '#fff' },
  whatsapp:  { icon: MessageCircle,   label: 'WhatsApp',  bg: '#25D366', text: '#fff' },
  wa:        { icon: MessageCircle,   label: 'WhatsApp',  bg: '#25D366', text: '#fff' },
  email:     { icon: Mail,            label: 'Email',     bg: '#EA4335', text: '#fff' },
  gmail:     { icon: Mail,            label: 'Gmail',     bg: '#EA4335', text: '#fff' },
  csv:       { icon: FileSpreadsheet, label: 'CSV',       bg: '#475569', text: '#fff' },
  linkedin:  { icon: Linkedin,        label: 'LinkedIn',  bg: '#0A66C2', text: '#fff' },
  website:   { icon: Globe,           label: 'אתר',       bg: '#6366F1', text: '#fff' },
  referral:  { icon: User,            label: 'המלצה',     bg: '#F59E0B', text: '#fff' },
  phone:     { icon: Phone,           label: 'טלפון',     bg: '#64748B', text: '#fff' },
};

// Hebrew/English keyword → source key. Order matters (specific first).
const KEYWORD_MAP = [
  ['אינסטגרם',     'instagram'],
  ['instagram',    'instagram'],
  ['ig ',          'instagram'],
  ['ווטסאפ',       'whatsapp'],
  ['וואטסאפ',      'whatsapp'],
  ['whatsapp',     'whatsapp'],
  ['wa.me',        'whatsapp'],
  ['פייסבוק',      'facebook'],
  ['facebook',     'facebook'],
  ['fb.com',       'facebook'],
  ['לינקדאין',    'linkedin'],
  ['linkedin',     'linkedin'],
  ['גוגל',         'google'],
  ['google',       'google'],
  ['sheets',       'sheets'],
  ['gmail',        'gmail'],
  ['email',        'email'],
  ['מייל',         'email'],
  ['@',            'email'],
  ['csv',          'csv'],
  ['אתר',          'website'],
  ['website',      'website'],
  ['המלצה',        'referral'],
  ['חבר',          'referral'],
  ['referral',     'referral'],
  ['טלפון',        'phone'],
  ['phone',        'phone'],
];

function detectSource(source) {
  if (!source) return null;
  const lower = String(source).toLowerCase();
  for (const [kw, key] of KEYWORD_MAP) {
    if (lower.includes(kw)) return key;
  }
  return null;
}

export default function SourceBadge({ source }) {
  const key = detectSource(source);
  const config = key ? SOURCE_CONFIG[key] : null;

  if (!config) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-full font-medium border border-slate-200 max-w-[140px]"
        title={source || 'לא ידוע'}
      >
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">לא ידוע</span>
      </span>
    );
  }

  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-bold text-xs shadow-sm max-w-[140px]"
      style={{ background: config.bg, color: config.text }}
      title={source}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} />
      <span className="truncate">{config.label}</span>
    </span>
  );
}