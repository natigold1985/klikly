import React from 'react';
import { FileSpreadsheet, MessageCircle, Instagram, Facebook, Mail, Globe, User } from 'lucide-react';

const SOURCE_CONFIG = {
  google: { icon: FileSpreadsheet, label: 'Google', color: 'bg-green-500' },
  sheets: { icon: FileSpreadsheet, label: 'Sheets', color: 'bg-green-500' },
  facebook: { icon: Facebook, label: 'Facebook', color: 'bg-blue-600' },
  fb: { icon: Facebook, label: 'Facebook', color: 'bg-blue-600' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'bg-gradient-to-tr from-purple-500 to-pink-500' },
  ig: { icon: Instagram, label: 'Instagram', color: 'bg-gradient-to-tr from-purple-500 to-pink-500' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'bg-[#25D366]' },
  wa: { icon: MessageCircle, label: 'WhatsApp', color: 'bg-[#25D366]' },
  email: { icon: Mail, label: 'Email', color: 'bg-red-500' },
  csv: { icon: FileSpreadsheet, label: 'CSV', color: 'bg-slate-600' },
  website: { icon: Globe, label: 'אתר', color: 'bg-indigo-500' },
  referral: { icon: User, label: 'המלצה', color: 'bg-amber-500' },
};

function getSourceKey(source) {
  if (!source) return null;
  const lower = source.toLowerCase();
  for (const key of Object.keys(SOURCE_CONFIG)) {
    if (lower.includes(key)) return key;
  }
  if (lower.includes('המלצה') || lower.includes('חבר')) return 'referral';
  if (lower.includes('גוגל')) return 'google';
  if (lower.includes('פייסבוק')) return 'facebook';
  if (lower.includes('אינסטגרם')) return 'instagram';
  if (lower.includes('ווטסאפ')) return 'whatsapp';
  return null;
}

export default function SourceBadge({ source }) {
  const key = getSourceKey(source);
  const config = key ? SOURCE_CONFIG[key] : null;

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
        <Globe className="w-3 h-3" />
        {source || 'לא ידוע'}
      </span>
    );
  }

  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white px-2.5 py-1 rounded-full font-medium shadow-sm" style={{ minWidth: 'fit-content' }}>
      <span className={`w-5 h-5 rounded-full ${config.color} flex items-center justify-center shrink-0`}>
        <Icon className="w-3 h-3 text-white" />
      </span>
      <span className="text-slate-700">{source || config.label}</span>
    </span>
  );
}