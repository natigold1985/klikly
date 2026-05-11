import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN');
const APP_SECRET = Deno.env.get('META_APP_SECRET');

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifySignature(rawBody, signatureHeader) {
  if (!APP_SECRET || !signatureHeader?.startsWith('sha256=')) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return timingSafeEqual(`sha256=${arrayBufferToHex(signature)}`, signatureHeader);
}

function extractWhatsAppLeads(payload) {
  const leads = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contactsByWaId = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));
      for (const message of value.messages || []) {
        const phone = message.from;
        const contact = contactsByWaId.get(phone);
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '';
        leads.push({
          phone,
          name: contact?.profile?.name || phone,
          notes: text ? `הודעת WhatsApp: ${text}` : 'ליד נכנס מ-WhatsApp Business API',
        });
      }
    }
  }
  return leads;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === VERIFY_TOKEN) return new Response(challenge || '', { status: 200 });
      return new Response('Verification failed', { status: 403 });
    }

    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const rawBody = await req.text();
    const isValidSignature = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'));
    if (!isValidSignature) return Response.json({ error: 'Invalid Meta signature' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const payload = JSON.parse(rawBody || '{}');
    const leads = extractWhatsAppLeads(payload);
    let handled = 0;

    for (const item of leads) {
      const existing = await base44.asServiceRole.entities.Lead.filter({ phone: item.phone }, '-created_date', 1);
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Lead.update(existing[0].id, {
          source: existing[0].source || 'WhatsApp',
          notes: [existing[0].notes, item.notes].filter(Boolean).join('\n'),
          last_contact_date: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.Lead.create({
          name: item.name,
          phone: item.phone,
          source: 'WhatsApp',
          status: 'new',
          notes: item.notes,
          last_contact_date: new Date().toISOString(),
        });
      }
      handled += 1;
    }

    return Response.json({ success: true, handled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});