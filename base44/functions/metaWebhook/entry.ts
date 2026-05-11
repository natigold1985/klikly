import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const META_GRAPH_VERSION = 'v20.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN');
const APP_SECRET = Deno.env.get('META_APP_SECRET');
const PAGE_ACCESS_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN');

const LEAD_KEYWORDS = [
  'קורס',
  'קורס צילום',
  'לימודי צילום',
  'אני',
  'צלם',
  'צלמת',
  'קורס צילום למתחילים',
  'צילום למתחילים',
  'ללמוד צילום'
];

const AUTO_REPLY = 'היי! תודה שפנית 🙏 אשמח לשלוח לך פרטים על קורס הצילום. כדי שאוכל לחזור אליך, אפשר לשלוח כאן שם מלא וטלפון?';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isRelevantLead(text) {
  const normalized = normalizeText(text);
  return LEAD_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySignature(rawBody, signatureHeader) {
  if (!APP_SECRET || !signatureHeader?.startsWith('sha256=')) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = `sha256=${arrayBufferToHex(signature)}`;
  return timingSafeEqual(expected, signatureHeader);
}

async function sendMetaMessage(recipientId, text) {
  const response = await fetch(`${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Meta message failed: ${details}`);
  }

  return response.json();
}

async function getMetaProfile(userId) {
  const response = await fetch(`${META_GRAPH_BASE}/${userId}?fields=name,username&access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`);
  if (!response.ok) return null;
  return response.json();
}

async function createInstagramLead(base44, senderId, messageText) {
  const profile = await getMetaProfile(senderId);
  const displayName = profile?.name || profile?.username || `Instagram ${senderId}`;
  const existingLeads = await base44.asServiceRole.entities.Lead.filter({ source: 'Instagram DM', source_post_url: senderId }, '-created_date', 1);

  if (existingLeads.length > 0) {
    await base44.asServiceRole.entities.Lead.update(existingLeads[0].id, {
      notes: `${existingLeads[0].notes || ''}\n\nהודעת DM נוספת: ${messageText}`.trim(),
      last_contact_date: new Date().toISOString()
    });
    return existingLeads[0];
  }

  return base44.asServiceRole.entities.Lead.create({
    name: displayName,
    phone: 'לא נמסר',
    shooting_type: 'קורס צילום',
    status: 'new',
    source: 'Instagram DM',
    source_post_url: senderId,
    notes: `ליד אוטומטי מ-Instagram DM. הודעה מקורית: ${messageText}`,
    last_contact_date: new Date().toISOString()
  });
}

function extractMessagingEvents(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const messaging of entry.messaging || []) {
      if (messaging?.sender?.id && messaging?.message?.text && !messaging.message.is_echo) {
        events.push({ senderId: messaging.sender.id, text: messaging.message.text });
      }
    }
  }
  return events;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new Response(challenge || '', { status: 200 });
      }

      return new Response('Verification failed', { status: 403 });
    }

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const rawBody = await req.text();
    const isValidSignature = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'));
    if (!isValidSignature) {
      return Response.json({ error: 'Invalid Meta signature' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const payload = JSON.parse(rawBody || '{}');
    const events = extractMessagingEvents(payload);
    let handled = 0;

    for (const event of events) {
      if (isRelevantLead(event.text)) {
        await createInstagramLead(base44, event.senderId, event.text);
        await sendMetaMessage(event.senderId, AUTO_REPLY);
        handled += 1;
      }
    }

    return Response.json({ success: true, handled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});