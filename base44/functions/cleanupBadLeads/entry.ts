import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Normalize phone for dedup comparison
const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
};

// Validate Israeli phone — must be 9-10 digits, starting with 0 or 5/7 area codes
const isValidPhone = (phone) => {
  const p = normalizePhone(phone);
  if (!p) return false;
  if (p.length < 9 || p.length > 13) return false;
  // Must contain real digits (not all zeros / all same)
  if (/^(\d)\1+$/.test(p)) return false;
  // Reject obvious test/fake numbers
  if (p.endsWith('0000000') || p.endsWith('1234567') || p.endsWith('1234')) return false;
  if (['0501234567', '0521234567', '0541234567', '0551234567', '0509773600'].includes(p)) return false;
  return true;
};

const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Detect "junk" leads: groups, posts, jobs, facebook pages, etc.
const isJunkLead = (lead) => {
  const text = [
    lead.name || '',
    lead.source || '',
    lead.notes || '',
    lead.shooting_type || '',
  ].join(' ').toLowerCase();

  const junkPatterns = [
    'קבוצה:',
    'פוסטים בפייסבוק',
    'facebook pages',
    'pages/',
    'linkedin/jobs',
    'linkedin.com/jobs',
    'job-board',
    'דרושים לצלמים',
    'צלמים ועורכים',
    'שיווק לצלמים',
    'עסקים קטנים — קורס',
    'קורס sba',
    'תגובה על פוסט',
    'contact form\nevent-photography',
  ];

  for (const p of junkPatterns) {
    if (text.includes(p.toLowerCase())) return true;
  }

  const source = (lead.source || '').toLowerCase();
  const notes = (lead.notes || '').toLowerCase();
  const name = (lead.name || '').toLowerCase();

  // LinkedIn lead without a profile URL — useless
  if (source.includes('linkedin')) {
    const hasProfileUrl = /linkedin\.com\/in\//.test(notes) || /linkedin\.com\/in\//.test(name);
    if (!hasProfileUrl) return true;
  }

  // Defense Industry / generic role-based leads — no real person
  if (source.includes('defense') || source.includes('ביטחון')) {
    return true;
  }

  // Facebook/WhatsApp leads where shooting_type is actually our auto-reply bot text (starts with היי / שלום and ends with natigold.com link)
  if ((source.includes('facebook') || source.includes('whatsapp')) ) {
    const st = (lead.shooting_type || '').toLowerCase();
    if (st.includes('natigold.com') || st.includes('היי!') || st.includes('שבעה ימים להבין הכל')) {
      return true;
    }
    if (notes.includes('natigold.com/photography-course') || notes.includes('שבעה ימים להבין הכל')) {
      return true;
    }
  }

  return false;
};

// Fake/sample leads — common test names
const isFakeLead = (lead) => {
  const name = (lead.name || '').toLowerCase().trim();
  const fakeNames = [
    'john doe', 'sarah cohen', 'rachel levi', 'shira attal', 'anna schwartz',
    'yoni livshits', 'daniel cohen', 'eliana goldstein', 'roi shmuel',
    'dorin weil', 'יוסי כהן', 'bracha a', 'לני מידן', 'יוסי לוי',
    'nati gold', 'נתי גולד', 'natigold',
  ];
  return fakeNames.includes(name);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);

    const toDelete = [];
    const reasons = { no_contact: 0, junk: 0, fake: 0, duplicate: 0 };

    // Pass 1: mark junk / fake / no-contact leads for deletion
    const survivors = [];
    for (const lead of allLeads) {
      if (isFakeLead(lead)) {
        toDelete.push({ id: lead.id, reason: 'fake', name: lead.name });
        reasons.fake++;
        continue;
      }
      if (isJunkLead(lead)) {
        toDelete.push({ id: lead.id, reason: 'junk', name: lead.name });
        reasons.junk++;
        continue;
      }
      const hasPhone = isValidPhone(lead.phone);
      const hasEmail = isValidEmail(lead.email);
      if (!hasPhone && !hasEmail) {
        toDelete.push({ id: lead.id, reason: 'no_contact', name: lead.name });
        reasons.no_contact++;
        continue;
      }
      survivors.push(lead);
    }

    // Pass 2: dedup survivors by phone (keep oldest = first record)
    const seenPhones = new Map();
    const seenEmails = new Map();
    for (const lead of survivors.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))) {
      const phoneKey = normalizePhone(lead.phone);
      const emailKey = (lead.email || '').toLowerCase().trim();

      let isDup = false;
      if (phoneKey && seenPhones.has(phoneKey)) isDup = true;
      if (emailKey && seenEmails.has(emailKey)) isDup = true;

      if (isDup) {
        toDelete.push({ id: lead.id, reason: 'duplicate', name: lead.name });
        reasons.duplicate++;
        continue;
      }

      if (phoneKey) seenPhones.set(phoneKey, lead.id);
      if (emailKey) seenEmails.set(emailKey, lead.id);
    }

    // Execute deletions
    let deleted = 0;
    for (const item of toDelete) {
      try {
        await base44.asServiceRole.entities.Lead.delete(item.id);
        deleted++;
      } catch (e) {
        console.error('Failed to delete', item.id, e.message);
      }
    }

    return Response.json({
      success: true,
      total_scanned: allLeads.length,
      deleted,
      remaining: allLeads.length - deleted,
      reasons,
      sample_deleted: toDelete.slice(0, 20),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});