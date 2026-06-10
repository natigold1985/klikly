export const STATUS_STYLES = {
  'ליד חדש':      { label: 'ליד חדש',      pill: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',       dot: 'bg-blue-500' },
  'נוצר קשר':    { label: 'נוצר קשר',    pill: 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold',  dot: 'bg-yellow-400' },
  'נשלח פולו-אפ':{ label: 'נשלח פולו-אפ',pill: 'bg-purple-200 text-purple-900 border-purple-400 font-bold', dot: 'bg-purple-500' },
  'נענה':         { label: 'נענה',         pill: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold', dot: 'bg-yellow-500' },
  'נסגר בהצלחה': { label: 'נסגר בהצלחה', pill: 'bg-green-200 text-green-900 border-green-500 font-black',   dot: 'bg-green-500' },
  'לא רלוונטי':  { label: 'לא רלוונטי',  pill: 'bg-red-200 text-red-900 border-red-400 font-bold',          dot: 'bg-red-500' },
  new:         { label: 'ליד חדש',      pill: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',       dot: 'bg-blue-500' },
  in_progress: { label: 'נוצר קשר',    pill: 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold',  dot: 'bg-yellow-400' },
  follow_up:   { label: 'נשלח פולו-אפ',pill: 'bg-purple-200 text-purple-900 border-purple-400 font-bold', dot: 'bg-purple-500' },
  quote_sent:  { label: 'נענה',         pill: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold', dot: 'bg-yellow-500' },
  closed_won:  { label: 'נסגר בהצלחה', pill: 'bg-green-200 text-green-900 border-green-500 font-black',   dot: 'bg-green-500' },
  closed_lost: { label: 'לא רלוונטי',  pill: 'bg-red-200 text-red-900 border-red-400 font-bold',          dot: 'bg-red-500' },
};

export const STATUS_VALUE_MAP = {
  new: 'ליד חדש',
  in_progress: 'נוצר קשר',
  follow_up: 'נשלח פולו-אפ',
  quote_sent: 'נענה',
  closed_won: 'נסגר בהצלחה',
  closed_lost: 'לא רלוונטי',
};

export function normalizeLeadStatus(status) {
  return STATUS_VALUE_MAP[status] || status || 'ליד חדש';
}

export function normalizeIsraeliPhone(phone = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('972') && digits.length >= 11) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (/^[234589]\d{7,8}$/.test(digits)) return `0${digits}`;
  return digits;
}

export function getIsraeliWhatsAppPhone(phone = '') {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return '';
  return normalized.startsWith('0') ? `972${normalized.slice(1)}` : normalized;
}

const UNKNOWN_SOURCES = ['לא ידוע', 'unknown', 'none', '-', 'n/a', ''];

export function cleanLeadNotes(notes = '') {
  return String(notes || '')
    .replace(/קישור:\s*https?:\/\/\S+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/source[_\s-]*url:?/gi, '')
    .replace(/\b(null|undefined|nan)\b/gi, '')
    .replace(/\s*[|•]\s*/g, ' • ')
    .replace(/(?:\s*•\s*){2,}/g, ' • ')
    .replace(/^\s*•\s*|\s*•\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function inferLeadSource(lead = {}) {
  const current = String(lead.source || '').trim();
  const text = [lead.notes, lead.shooting_type, lead.source_post_url, current].filter(Boolean).join(' ').toLowerCase();

  if (/klikly|whatsapp|וואטסאפ|ווטסאפ|wa\.me/.test(text)) return 'WhatsApp';
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'קורס צילום';
  if (/צילום|צלם|צילומים|stills|photo|photography/.test(text)) return 'צילום';
  if (current && !UNKNOWN_SOURCES.includes(current.toLowerCase())) return current;
  return 'לא ידוע';
}

export function inferLeadType(lead = {}) {
  if (lead.lead_type) return lead.lead_type;
  const text = [lead.shooting_type, lead.notes].filter(Boolean).join(' ');
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'מתעניין בקורס';
  if (/צילום|צלם|צילומים|חתונה|אירוע|תדמית|סטודיו|photo|photography/.test(text)) return 'שירותי צילום';
  return lead.shooting_type || '';
}

export function inferLeadRole(lead = {}) {
  if (lead.role_title) return lead.role_title;
  const text = String(lead.notes || '');
  const roles = [
    'מנהלת שיווק', 'מנהל שיווק', 'שיווק', 'Marketing Manager',
    'HR', 'משאבי אנוש', 'משקית תש', 'משקית ת״ש', 'מנהלת רווחה', 'מנהל רווחה',
    'מפיקת אירועים', 'מפיק אירועים', 'בעלים', 'מנכ״ל', 'מנכל', 'CEO'
  ];
  return roles.find((role) => text.toLowerCase().includes(role.toLowerCase())) || '';
}

export function highlightLeadInterest(lead = {}) {
  return inferLeadType(lead);
}

export function enhanceLeadForDisplay(lead = {}) {
  return {
    ...lead,
    status: normalizeLeadStatus(lead.status),
    source: inferLeadSource(lead),
    notes: cleanLeadNotes(lead.notes),
    lead_type: inferLeadType(lead),
    role_title: inferLeadRole(lead),
    interest_label: highlightLeadInterest(lead),
  };
}