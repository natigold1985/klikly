import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanLeadNotes(notes = '') {
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

function inferLeadSource(lead = {}) {
  const current = String(lead.source || '').trim();
  const text = [lead.notes, lead.shooting_type, lead.source_post_url, current].filter(Boolean).join(' ').toLowerCase();
  if (/klikly|whatsapp|וואטסאפ|ווטסאפ|wa\.me/.test(text)) return 'WhatsApp';
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'קורס צילום';
  if (/צילום|צלם|צילומים|stills|photo|photography/.test(text)) return 'צילום';
  if (current && !['לא ידוע', 'unknown', 'none', '-', 'n/a'].includes(current.toLowerCase())) return current;
  return 'לא ידוע';
}

function inferLeadType(lead = {}) {
  if (lead.lead_type) return lead.lead_type;
  const text = [lead.shooting_type, lead.notes].filter(Boolean).join(' ');
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'מתעניין בקורס';
  if (/צילום|צלם|צילומים|חתונה|אירוע|תדמית|סטודיו|photo|photography/.test(text)) return 'שירותי צילום';
  return '';
}

function inferRoleTitle(lead = {}) {
  if (lead.role_title) return lead.role_title;
  const text = String(lead.notes || '').toLowerCase();
  const roles = ['מנהלת שיווק', 'מנהל שיווק', 'שיווק', 'marketing manager', 'hr', 'משאבי אנוש', 'משקית תש', 'משקית ת״ש', 'מנהלת רווחה', 'מנהל רווחה', 'מפיקת אירועים', 'מפיק אירועים', 'בעלים', 'מנכ״ל', 'מנכל', 'ceo'];
  return roles.find((role) => text.includes(role.toLowerCase())) || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.email !== 'natigold04@gmail.com') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);
    let updated = 0;

    for (const lead of leads) {
      const cleanedNotes = cleanLeadNotes(lead.notes);
      const source = inferLeadSource({ ...lead, notes: cleanedNotes });
      const leadType = inferLeadType({ ...lead, notes: cleanedNotes });
      const roleTitle = inferRoleTitle({ ...lead, notes: cleanedNotes });
      const updates = {};

      if ((lead.notes || '') !== cleanedNotes) updates.notes = cleanedNotes;
      if ((lead.source || '') !== source) updates.source = source;
      if (leadType && !lead.lead_type) updates.lead_type = leadType;
      if (roleTitle && !lead.role_title) updates.role_title = roleTitle;

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Lead.update(lead.id, updates);
        updated += 1;
      }
    }

    return Response.json({ success: true, scanned: leads.length, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});