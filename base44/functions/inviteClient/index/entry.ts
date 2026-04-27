import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const photographer = await base44.auth.me();
    if (!photographer) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, email, phone } = await req.json();
    if (!email || !full_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already exists in TeamMember
    const existing = await base44.asServiceRole.entities.TeamMember.filter({ email: normalizedEmail });
    if (existing.length > 0) {
      const m = existing[0];
      // Assign to this photographer if not assigned yet
      if (!m.assigned_photographer_email) {
        await base44.asServiceRole.entities.TeamMember.update(m.id, {
          assigned_photographer_email: photographer.email,
          phone: phone || m.phone,
          role: 'client',
          is_active: true,
        });
      }
      return Response.json({ success: true, alreadyExisted: true });
    }

    // Create TeamMember directly — no invite, no waiting
    await base44.asServiceRole.entities.TeamMember.create({
      email: normalizedEmail,
      full_name,
      phone: phone || '',
      role: 'client',
      assigned_photographer_email: photographer.email,
      is_active: true,
    });

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("inviteClient error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});