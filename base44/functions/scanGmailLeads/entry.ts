import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // This can be called from webhook automation or manually
    const messageIds = body.data?.new_message_ids || [];
    
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let idsToProcess = messageIds;

    // If no webhook message IDs, fetch recent emails (manual trigger)
    if (idsToProcess.length === 0) {
      const query = encodeURIComponent('is:unread newer_than:1d (צילום OR חתונה OR צלם OR אירוע OR "בר מצווה" OR photographer OR wedding OR "contact form" OR "צור קשר")');
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${query}`,
        { headers: authHeader }
      );
      if (!listRes.ok) {
        return Response.json({ error: 'Failed to list messages', status: listRes.status }, { status: 500 });
      }
      const listData = await listRes.json();
      idsToProcess = (listData.messages || []).map(m => m.id);
    }

    if (idsToProcess.length === 0) {
      return Response.json({ success: true, found: 0, saved: 0, message: 'No new relevant emails' });
    }

    // Fetch email content
    const emails = [];
    for (const msgId of idsToProcess.slice(0, 15)) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const msg = await res.json();

      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Extract body text
      let bodyText = '';
      const extractText = (part) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (part.parts) part.parts.forEach(extractText);
      };
      extractText(msg.payload);

      emails.push({ subject, from, date, body: bodyText.substring(0, 1000), id: msgId });
    }

    if (emails.length === 0) {
      return Response.json({ success: true, found: 0, saved: 0 });
    }

    // Use AI to extract leads from emails
    const emailSummary = emails.map(e => 
      `---\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body}\n---`
    ).join('\n');

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a lead extraction assistant for a professional photographer in Israel.
Analyze these emails and extract potential photography leads (people inquiring about photography services).

Look for:
- Contact form submissions mentioning photography
- Inquiries about weddings, events, bar/bat mitzvahs, portraits
- Newsletter signups that mention photography interest
- Direct messages asking for photography services

For each lead found, extract:
- name: the person's name
- phone: phone number if available
- email: their email address
- shooting_type: what type of photography they need
- notes: brief context about the inquiry

IMPORTANT: Only extract REAL leads - people genuinely looking for photography services.
Do NOT extract spam, marketing emails, or unrelated correspondence.

Emails:
${emailSummary}`,
      response_json_schema: {
        type: 'object',
        properties: {
          leads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                shooting_type: { type: 'string' },
                notes: { type: 'string' },
              }
            }
          }
        }
      }
    });

    const leads = (result.leads || []).filter(l => l.name && (l.phone || l.email));

    if (leads.length === 0) {
      return Response.json({ success: true, found: 0, saved: 0, message: 'No leads found in emails' });
    }

    // Deduplicate against existing leads
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({}, '-created_date', 500);
    const existingPhones = new Set(existingLeads.map(l => l.phone?.replace(/[^0-9]/g, '')).filter(Boolean));
    const existingEmails = new Set(existingLeads.filter(l => l.email).map(l => l.email.toLowerCase()));

    const newLeads = [];
    let updatedCount = 0;

    for (const l of leads) {
      const normalizedPhone = l.phone?.replace(/[^0-9]/g, '');
      const normalizedEmail = l.email?.toLowerCase();
      const existingByPhone = normalizedPhone && existingLeads.find(ex => ex.phone?.replace(/[^0-9]/g, '') === normalizedPhone);
      const existingByEmail = normalizedEmail && existingLeads.find(ex => ex.email?.toLowerCase() === normalizedEmail);
      const existing = existingByPhone || existingByEmail;

      if (existing) {
        const updateData = {};
        if (l.shooting_type && !existing.shooting_type) updateData.shooting_type = l.shooting_type;
        if (l.notes) updateData.notes = [existing.notes, l.notes].filter(Boolean).join(' | ');
        if (l.email && !existing.email) updateData.email = l.email;
        if (l.phone && !existing.phone) updateData.phone = l.phone;
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Lead.update(existing.id, updateData);
          updatedCount++;
        }
      } else {
        newLeads.push(l);
      }
    }

    if (newLeads.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkCreate(newLeads.map(l => ({
        name: l.name,
        phone: l.phone || '',
        email: l.email || '',
        shooting_type: l.shooting_type || '',
        notes: l.notes || '',
        status: 'new',
        source: 'Gmail',
        last_contact_date: new Date().toISOString(),
      })));
    }

    // Log activity
    await base44.asServiceRole.entities.SystemLog.create({
      action: 'gmail_lead_scan',
      details: `Gmail scan: ${leads.length} found, ${newLeads.length} new, ${updatedCount} updated`,
      status: 'success',
    });

    return Response.json({
      success: true,
      found: leads.length,
      saved: newLeads.length,
      updated: updatedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});