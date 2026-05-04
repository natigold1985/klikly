// Scheduled sync from Google Sheets to Lead entity.
// Runs twice daily (09:00 and 21:00 Asia/Jerusalem) per the user's automations.
// Includes a circuit-breaker against runaway loops:
//   - In-memory `isRunning` guard within a single instance.
//   - SystemLog history check: if we've run >= 4 times in the last 60 minutes, abort.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

let isRunning = false;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Concurrency guard ─────────────────────────────────────────────
    if (isRunning) {
      console.log('runScheduledSheetsSync: already running, skipping');
      return Response.json({ success: true, skipped: 'already_running' });
    }
    isRunning = true;

    // ── Circuit breaker: prevent runaway loops ────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.SystemLog.filter(
      { action: 'scheduled_sheets_sync' },
      '-created_date',
      10
    );
    const recentCount = recentLogs.filter(l => l.created_date > oneHourAgo).length;
    if (recentCount >= 4) {
      isRunning = false;
      console.warn(`runScheduledSheetsSync: circuit-breaker tripped — ${recentCount} runs in last hour. Aborting.`);
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'scheduled_sheets_sync_blocked',
        details: `Circuit breaker tripped: ${recentCount} runs in last 60min`,
        status: 'error',
      });
      return Response.json({ success: false, error: 'rate_limited', recentCount }, { status: 429 });
    }

    // Fetch all photographer settings that have sync enabled & a sheet URL
    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 100);
    const targets = allSettings.filter(s =>
      s.google_sheet_url && s.google_sheet_sync_enabled !== false
    );

    if (targets.length === 0) {
      isRunning = false;
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'scheduled_sheets_sync',
        details: 'No photographers with sheet sync configured',
        status: 'success',
      });
      return Response.json({ success: true, message: 'no_sheets_configured', synced: 0 });
    }

    // Connector token (shared connector — app builder's auth)
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlesheets');
      accessToken = conn.accessToken;
    } catch (e) {
      isRunning = false;
      console.error('googlesheets not connected:', e.message);
      return Response.json({ success: false, error: 'googlesheets_not_connected' }, { status: 400 });
    }

    let totalAdded = 0;
    let totalUpdated = 0;
    const perOwner = [];

    for (const settings of targets) {
      const ownerEmail = settings.created_by;
      const sheetUrl = settings.google_sheet_url;

      // Extract spreadsheet ID
      let spreadsheetId = null;
      const trimmed = sheetUrl.trim();
      let match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        spreadsheetId = match[1];
      } else {
        const segMatch = trimmed.match(/([a-zA-Z0-9_-]{20,})/);
        if (segMatch) spreadsheetId = segMatch[1];
      }
      if (!spreadsheetId) continue;

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:Z`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (!response.ok) {
        console.warn(`Sheet fetch failed for ${ownerEmail}:`, response.status);
        continue;
      }
      const data = await response.json();
      const rows = data.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('שם'));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('טלפון'));
      const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('מייל') || h.includes('דוא"ל'));
      const sourceIdx = headers.findIndex(h => h.includes('source') || h.includes('מקור'));
      const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('סוג'));
      const addressIdx = headers.findIndex(h => h.includes('address') || h.includes('כתובת'));

      if (nameIdx === -1 || phoneIdx === -1) continue;

      // Existing leads for this owner
      const existing = await base44.asServiceRole.entities.Lead.filter({ created_by: ownerEmail }, '-created_date', 500);
      const phoneMap = {};
      for (const lead of existing) {
        if (lead.phone) phoneMap[lead.phone.replace(/[^0-9]/g, '')] = lead;
      }

      let added = 0;
      let updated = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[nameIdx] || '';
        const phone = row[phoneIdx] || '';
        const email = emailIdx !== -1 ? (row[emailIdx] || '') : '';
        const source = sourceIdx !== -1 ? (row[sourceIdx] || '') : 'Google Sheets';
        const shootingType = typeIdx !== -1 ? (row[typeIdx] || '') : '';
        const address = addressIdx !== -1 ? (row[addressIdx] || '') : '';

        if (!name && !phone) continue;
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        // Detect junk leads (invalid phone / placeholder name) — they're still saved but marked as filtered
        const lowName = String(name).toLowerCase().trim();
        const junkNames = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא'];
        const isInvalidPhone = !cleanPhone || cleanPhone.length < 9 || cleanPhone.length > 13;
        const isPlaceholderName = !name || junkNames.some(j => lowName === j) || lowName.includes('ליד ללא שם');
        const isJunk = isInvalidPhone || isPlaceholderName;
        const junkReason = isInvalidPhone ? 'invalid_phone' : (isPlaceholderName ? 'no_name' : null);

        const matchLead = phoneMap[cleanPhone];
        if (matchLead) {
          const updates = {};
          if (email && !matchLead.email) updates.email = email;
          if (source && !matchLead.source) updates.source = source;
          if (shootingType && !matchLead.shooting_type) updates.shooting_type = shootingType;
          if (address && !matchLead.address) updates.address = address;
          if (name && name !== matchLead.name && matchLead.name === 'לא ידוע') updates.name = name;
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Lead.update(matchLead.id, updates);
            updated++;
          }
        } else {
          await base44.asServiceRole.entities.Lead.create({
            name: name || 'לא ידוע',
            phone,
            email: email || undefined,
            source: source || 'Google Sheets',
            shooting_type: shootingType || undefined,
            address: address || undefined,
            status: 'new',
            last_contact_date: new Date().toISOString(),
            is_filtered: isJunk,
            filter_reason: junkReason || undefined,
          });
          added++;
          if (cleanPhone) phoneMap[cleanPhone] = { phone, name };
        }
      }

      totalAdded += added;
      totalUpdated += updated;
      perOwner.push({ owner: ownerEmail, added, updated });
    }

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'scheduled_sheets_sync',
      details: `Sync complete. Added: ${totalAdded}, Updated: ${totalUpdated}, Owners: ${targets.length}`,
      status: 'success',
    });

    isRunning = false;
    return Response.json({
      success: true,
      added: totalAdded,
      updated: totalUpdated,
      owners: perOwner,
    });
  } catch (error) {
    isRunning = false;
    console.error('runScheduledSheetsSync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});