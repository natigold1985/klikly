import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN');
const APP_SECRET = Deno.env.get('META_APP_SECRET');
const PAGE_ACCESS_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN');
const GRAPH_VERSION = 'v20.0';

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

function fieldValue(fields, names) {
  const item = fields.find((field) => names.includes(String(field.name || '').toLowerCase()));
  return Array.isArray(item?.values) ? item.values[0] : '';
}

async function fetchLeadgen(leadgenId) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta lead fetch failed: ${await response.text()}`);
  return response.json();
}

function extractLeadgenIds(payload) {
  const ids = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) ids.push(change.value.leadgen_id);
    }
  }
  return ids;
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
    const leadgenIds = extractLeadgenIds(payload);
    let handled = 0;

    for (const leadgenId of leadgenIds) {
      const metaLead = await fetchLeadgen(leadgenId);
      const fields = metaLead.field_data || [];
      const phone = fieldValue(fields, ['phone_number', 'phone', 'טלפון', 'מספר_טלפון']);
      if (!phone) continue;

      const firstName = fieldValue(fields, ['first_name', 'שם_פרטי']);
      const fullName = fieldValue(fields, ['full_name', 'name', 'שם_מלא', 'שם']);
      const email = fieldValue(fields, ['email', 'אימייל']);
      const notes = fields.map((field) => `${field.name}: ${(field.values || []).join(', ')}`).join('\n');
      const existing = await base44.asServiceRole.entities.Lead.filter({ phone }, '-created_date', 1);

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Lead.update(existing[0].id, {
          name: existing[0].name || fullName || firstName || phone,
          email: existing[0].email || email,
          source: existing[0].source || 'Facebook Ads',
          notes: [existing[0].notes, notes].filter(Boolean).join('\n'),
          last_contact_date: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.Lead.create({
          name: fullName || firstName || phone,
          phone,
          email,
          source: 'Facebook Ads',
          status: 'new',
          notes,
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