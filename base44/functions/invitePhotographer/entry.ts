import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { full_name, email, phone, role } = await req.json();
    if (!email || !full_name || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['admin', 'user', 'client'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already in TeamMember
    const existing = await base44.asServiceRole.entities.TeamMember.filter({ email: normalizedEmail });
    if (existing.length > 0) {
      return Response.json({ error: 'משתמש עם המייל הזה כבר קיים' }, { status: 409 });
    }

    // Create TeamMember directly — no invite, no waiting, no race conditions
    await base44.asServiceRole.entities.TeamMember.create({
      email: normalizedEmail,
      full_name,
      phone: phone || '',
      role,
      is_active: true,
    });

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("invitePhotographer error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});