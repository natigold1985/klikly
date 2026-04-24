import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action } = body;

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
      await base44.asServiceRole.entities.Quote.update(quote.id, {
        status: 'accepted',
      });

      // If linked to a lead, update lead status to closed_won
      if (quote.lead_id) {
        await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
          status: 'closed_won',
        });
      }

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        related_to_type: 'quote',
        related_to_id: quote.id,
        activity_type: 'payment_received',
        title: 'הצעת מחיר אושרה על ידי הלקוח',
        description: `${quote.client_name} אישר/ה את הצעת המחיר בסך ₪${quote.total_price}`,
      });

      return Response.json({ success: true, status: 'accepted', quote });
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});