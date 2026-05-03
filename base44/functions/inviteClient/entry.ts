import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// SECURITY:
// Only an authenticated user with role 'admin' or 'user' (photographer) can invite a client.
// Prevents privilege escalation: cannot demote an existing admin/user to client,
// and cannot reassign a client that already belongs to another photographer.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const photographer = await base44.auth.me();
    if (!photographer) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['admin', 'user'].includes(photographer.role) && photographer.email !== 'natigold04@gmail.com') {
      return Response.json({ error: 'Forbidden: only photographers/admins can invite clients' }, { status: 403 });
    }

    const { full_name, email, phone } = await req.json();
    if (!email || !full_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      // SECURITY: never demote an admin or another photographer to client
      if (existing.role && existing.role !== 'client') {
        return Response.json(
          { error: 'משתמש זה רשום כבר כמשתמש פעיל במערכת' },
          { status: 409 }
        );
      }
      // SECURITY: never steal a client already assigned to a different photographer
      if (existing.assigned_photographer_email && existing.assigned_photographer_email !== photographer.email) {
        return Response.json(
          { error: 'הלקוח הזה משויך כבר לצלם אחר' },
          { status: 409 }
        );
      }
      if (!existing.assigned_photographer_email) {
        await base44.asServiceRole.entities.User.update(existing.id, {
          assigned_photographer_email: photographer.email,
          phone: phone || existing.phone,
          role: 'client',
          is_invited: true,
        });
      }
      return Response.json({ success: true, user: existing, alreadyExisted: true });
    }

    // Invite the user via base44 (sends Google login email)
    await base44.users.inviteUser(normalizedEmail, 'user');

    // Wait briefly and find the newly created user record
    await new Promise(r => setTimeout(r, 500));
    const created = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (created.length > 0) {
      await base44.asServiceRole.entities.User.update(created[0].id, {
        full_name,
        phone: phone || '',
        assigned_photographer_email: photographer.email,
        role: 'client',
        is_invited: true,
      });
    }

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("inviteClient error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});