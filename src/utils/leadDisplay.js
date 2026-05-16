export const STATUS_STYLES = {
  new: { label: 'חדש', pill: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  in_progress: { label: 'בטיפול', pill: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  follow_up: { label: 'מעקב', pill: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  quote_sent: { label: 'הצעה נשלחה', pill: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  closed_won: { label: 'נסגר בהצלחה', pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  closed_lost: { label: 'לא מעוניין', pill: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
};

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
    source: inferLeadSource(lead),
    notes: cleanLeadNotes(lead.notes),
    lead_type: inferLeadType(lead),
    role_title: inferLeadRole(lead),
    interest_label: highlightLeadInterest(lead),
  };
}