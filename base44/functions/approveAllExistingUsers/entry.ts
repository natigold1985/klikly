import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// One-time migration: mark all existing users with a valid role (admin/user/client) as is_invited=true.
// Run this once after deploying the closed-system gate.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || (admin.role !== 'admin' && admin.email !== 'natigold04@gmail.com')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    let updated = 0;
    let skipped = 0;

    for (const u of allUsers) {
      if (u.is_invited === true) {
        skipped++;
        continue;
      }
      const role = u.role;
      if (role === 'admin' || role === 'user' || role === 'client') {
        await base44.asServiceRole.entities.User.update(u.id, { is_invited: true });
        updated++;
      } else {
        skipped++;
      }
    }

    return Response.json({ success: true, updated, skipped, total: allUsers.length });
  } catch (error) {
    console.error('approveAllExistingUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});