import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({ publicKey: Deno.env.get('VAPID_PUBLIC_KEY') });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});