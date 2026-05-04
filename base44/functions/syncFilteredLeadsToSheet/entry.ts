// Pushes leads marked as is_filtered=true OR status=closed_lost to a separate
// "מסוננים" tab in the user's Google Sheet. Append-only sync (no deletes).
// After sync, marks each lead with synced_to_filtered_sheet=true so we don't re-add them.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FILTERED_TAB_NAME = 'מסוננים';
const HEADERS = ['תאריך', 'שם', 'טלפון', 'אימייל', 'מקור', 'סטטוס', 'סיבת סינון', 'הערות'];
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit';

function extractSpreadsheetId(url) {
  if (!url) return null;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const m2 = url.match(/([a-zA-Z0-9_-]{20,})/);
  return m2 ? m2[1] : null;
}

async function ensureFilteredTab(spreadsheetId, accessToken) {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!metaResp.ok) throw new Error(`Failed to read sheet metadata: ${await metaResp.text()}`);
  const meta = await metaResp.json();
  const existingTab = (meta.sheets || []).find(s => s.properties?.title === FILTERED_TAB_NAME);

  if (existingTab) return existingTab.properties.sheetId;

  const createResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: FILTERED_TAB_NAME } } }],
    }),
  });
  if (!createResp.ok) throw new Error(`Failed to create tab: ${await createResp.text()}`);

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(FILTERED_TAB_NAME)}'!A1:H1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [HEADERS] }),
    }
  );
  return null;
}

async function appendRows(spreadsheetId, accessToken, rows) {
  if (rows.length === 0) return;
  const range = `'${FILTERED_TAB_NAME}'!A:H`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  });
  if (!resp.ok) throw new Error(`Failed to append rows: ${await resp.text()}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let userEmail = null;
    try {
      const user = await base44.auth.me();
      userEmail = user?.email;
    } catch (_) { /* scheduled */ }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Determine spreadsheet — from settings if configured, otherwise from request body, otherwise default
    let body = {};
    try { body = await req.json(); } catch (_) {}

    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 100);
    const targets = userEmail
      ? allSettings.filter(s => s.created_by === userEmail)
      : allSettings.filter(s => s.google_sheet_sync_enabled !== false);

    // Build per-owner sheet URL map. If no settings exist for the calling user, fall back to default.
    const ownerToSheet = {};
    for (const s of targets) {
      if (s.google_sheet_url) ownerToSheet[s.created_by] = s.google_sheet_url;
    }
    if (userEmail && !ownerToSheet[userEmail]) {
      ownerToSheet[userEmail] = body.sheetUrl || DEFAULT_SHEET_URL;
    }

    const owners = Object.keys(ownerToSheet);
    if (owners.length === 0) {
      return Response.json({ success: true, message: 'no_owners', synced: 0 });
    }

    let totalSynced = 0;
    const perOwner = [];

    for (const ownerEmail of owners) {
      const spreadsheetId = extractSpreadsheetId(ownerToSheet[ownerEmail]);
      if (!spreadsheetId) {
        perOwner.push({ owner: ownerEmail, error: 'invalid_sheet_url' });
        continue;
      }

      const filteredLeads = await base44.asServiceRole.entities.Lead.filter(
        { created_by: ownerEmail, synced_to_filtered_sheet: false },
        '-created_date',
        500
      );
      const toSync = filteredLeads.filter(l => l.is_filtered === true || l.status === 'closed_lost');

      if (toSync.length === 0) {
        perOwner.push({ owner: ownerEmail, synced: 0 });
        continue;
      }

      try {
        await ensureFilteredTab(spreadsheetId, accessToken);

        const rows = toSync.map(l => [
          new Date(l.created_date || Date.now()).toLocaleDateString('he-IL'),
          l.name || '',
          l.phone || '',
          l.email || '',
          l.source || '',
          l.status || '',
          l.filter_reason || (l.status === 'closed_lost' ? 'סומן ידנית כלא מעוניין' : ''),
          l.notes || '',
        ]);

        await appendRows(spreadsheetId, accessToken, rows);

        for (const l of toSync) {
          await base44.asServiceRole.entities.Lead.update(l.id, { synced_to_filtered_sheet: true });
        }

        totalSynced += toSync.length;
        perOwner.push({ owner: ownerEmail, synced: toSync.length, spreadsheetId });
      } catch (err) {
        console.error(`Failed for ${ownerEmail}:`, err);
        perOwner.push({ owner: ownerEmail, error: err.message });
      }
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'sync_filtered_leads_to_sheet',
      details: `Synced ${totalSynced} filtered leads across ${owners.length} owners`,
      status: 'success',
    });

    return Response.json({ success: true, synced: totalSynced, per_owner: perOwner });
  } catch (error) {
    console.error('syncFilteredLeadsToSheet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});