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
  if (/whatsapp|וואטסאפ|ווטסאפ|wa\.me/.test(text)) return 'WhatsApp';
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'קורס צילום';
  if (/צילום|צלם|צילומים|stills|photo|photography/.test(text)) return 'צילום';
  if (current && !['לא ידוע', 'unknown', 'none', '-', 'n/a'].includes(current.toLowerCase())) return current;
  return 'לא ידוע';
}

function highlightInterest(lead = {}) {
  const text = [lead.shooting_type, lead.notes].filter(Boolean).join(' ');
  if (/קורס|course|7 ימים|להבין הכל/.test(text)) return 'מתעניין בקורס צילום';
  if (/חתונה|wedding/.test(text)) return 'צילום חתונה';
  if (/אירוע|event|כנס|conference/.test(text)) return 'צילום אירוע';
  if (/תדמית|עסקי|business|מסחרי|stills/.test(text)) return 'צילום עסקי / תדמית';
  if (/whatsapp|וואטסאפ|ווטסאפ/.test(text)) return 'פנייה מ-WhatsApp';
  return '';
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
      const interest = highlightInterest({ ...lead, notes: cleanedNotes });
      const updates = {};

      if ((lead.notes || '') !== cleanedNotes) updates.notes = cleanedNotes;
      if ((lead.source || '') !== source) updates.source = source;
      if (interest && !lead.shooting_type) updates.shooting_type = interest;

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