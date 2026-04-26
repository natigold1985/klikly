import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = me.role === 'admin' || me.email === 'natigold04@gmail.com';

    const allUsers = await base44.asServiceRole.entities.User.list();
    let clients;
    if (isAdmin) {
      clients = allUsers.filter(u => u.role === 'client');
    } else {
      clients = allUsers.filter(u => u.role === 'client' && u.assigned_photographer_email === me.email);
    }

    // Get file counts per client
    const allPhotos = await base44.asServiceRole.entities.Photo.list('-created_date', 5000);
    const counts = {};
    for (const p of allPhotos) {
      if (p.client_email) {
        counts[p.client_email] = (counts[p.client_email] || 0) + 1;
      }
    }

    const result = clients.map(c => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      assigned_photographer_email: c.assigned_photographer_email,
      file_count: counts[c.email] || 0,
      created_date: c.created_date,
    }));

    return Response.json({ clients: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});