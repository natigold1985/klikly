import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizePhone = (phone) => String(phone || '').replace(/[^0-9]/g, '');

const isValidPhone = (phone) => {
  const digits = normalizePhone(phone);
  return digits.length >= 9 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
};

const isValidEmail = (email) => !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()));

const isFullName = (name) => {
  const clean = String(name || '').trim();
  const low = clean.toLowerCase();
  const bad = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא', 'שם'];
  if (!clean || bad.includes(low)) return false;
  if (/^https?:\/\//i.test(clean) || clean.includes('@')) return false;
  if (clean.replace(/[^0-9]/g, '').length >= 7) return false;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (/מנהל|מנהלת|אחראי|אחראית|marcom|marketing|communications|manager|תפקיד|חברה|מחלקה/i.test(clean)) return false;
  return /[א-תa-zA-Z]/.test(clean);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
    const toDelete = [];
    const reasons = { invalid_name: 0, no_valid_contact: 0 };

    for (const lead of leads) {
      const hasValidName = isFullName(lead.name);
      const hasValidContact = isValidPhone(lead.phone) || isValidEmail(lead.email);

      if (!hasValidName) {
        toDelete.push({ id: lead.id, reason: 'invalid_name', name: lead.name });
        reasons.invalid_name++;
        continue;
      }

      if (!hasValidContact) {
        toDelete.push({ id: lead.id, reason: 'no_valid_contact', name: lead.name });
        reasons.no_valid_contact++;
      }
    }

    let deleted = 0;
    for (const item of toDelete) {
      await base44.asServiceRole.entities.Lead.delete(item.id);
      deleted++;
    }

    return Response.json({
      success: true,
      total_scanned: leads.length,
      deleted,
      remaining: leads.length - deleted,
      reasons,
      sample_deleted: toDelete.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});