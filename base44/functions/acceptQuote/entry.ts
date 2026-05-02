import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action, signature_data, signer_name } = body;

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find quote by access_token (service role to bypass RLS)
    const quotes = await base44.asServiceRole.entities.Quote.filter({ access_token: token });
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Mark as viewed if first time
    if (!quote.viewed_at) {
      await base44.asServiceRole.entities.Quote.update(quote.id, {
        viewed_at: new Date().toISOString(),
        status: quote.status === 'sent' ? 'viewed' : quote.status,
      });
    }

    if (action === 'accept') {
      if (!signature_data || !signer_name) {
        return Response.json({ error: 'נדרשת חתימה ושם החותם לאישור ההצעה' }, { status: 400 });
      }

      // Get IP for legal documentation
      const signerIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        '';

      const signedAt = new Date().toISOString();

      await base44.asServiceRole.entities.Quote.update(quote.id, {
        status: 'accepted',
        signature_data,
        signer_name,
        signed_at: signedAt,
        signer_ip: signerIp,
      });

      // If linked to a lead, update lead status to closed_won (entity automation will create the project)
      let projectId = null;
      if (quote.lead_id) {
        await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
          status: 'closed_won',
        });

        // Wait briefly then look up the project that was just created by automation,
        // so we can attach its ID to the quote.
        try {
          await new Promise((r) => setTimeout(r, 1500));
          const projects = await base44.asServiceRole.entities.Project.filter({ lead_id: quote.lead_id });
          if (projects[0]) {
            projectId = projects[0].id;
            await base44.asServiceRole.entities.Quote.update(quote.id, { project_id: projectId });
          }
        } catch (e) {
          console.error('project lookup failed', e);
        }
      } else {
        // No lead linked — create project directly from the quote
        try {
          const project = await base44.asServiceRole.entities.Project.create({
            client_name: quote.client_name,
            client_email: quote.client_email,
            shooting_type: quote.package_name || '',
            status: 'pending_payment',
            total_price: quote.total_price || 0,
            package_details: quote.package_description || '',
            created_by: quote.created_by,
          });
          projectId = project.id;
          await base44.asServiceRole.entities.Quote.update(quote.id, { project_id: projectId });
        } catch (e) {
          console.error('direct project creation failed', e);
        }
      }

      // Log activity on the quote
      await base44.asServiceRole.entities.Activity.create({
        related_to_type: 'quote',
        related_to_id: quote.id,
        activity_type: 'payment_received',
        title: 'הצעת מחיר אושרה ונחתמה דיגיטלית',
        description: `${signer_name} חתם/ה על הצעת המחיר בסך ₪${quote.total_price}`,
        metadata: { signed_at: signedAt, signer_ip: signerIp, project_id: projectId },
      });

      return Response.json({ success: true, status: 'accepted', quote, project_id: projectId });
    }

    if (action === 'reject') {
      await base44.asServiceRole.entities.Quote.update(quote.id, {
        status: 'rejected',
      });

      return Response.json({ success: true, status: 'rejected', quote });
    }

    // Default: just return quote data for viewing
    return Response.json({ success: true, quote });
  } catch (error) {
    console.error('acceptQuote error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});