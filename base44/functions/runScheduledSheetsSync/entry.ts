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

    const body = await req.json().catch(() => ({}));
    const targets = [{
      ownerEmail: body.ownerEmail || 'natigold04@gmail.com',
      sheetUrl: body.sheetUrl || 'https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4/edit?gid=2039667077#gid=2039667077'
    }];

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

    const JOB_BOARD_INDICATORS = ['drushim', 'alljobs', 'job.co.il', 'linkedin.com/jobs', 'yad2', 'gov.il', 'mod.gov.il', 'industry.co.il', 'ביטחון', 'דרושים'];
    const BAD_NAMES = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא'];

    function normPhone(p) { return String(p || '').replace(/[^0-9]/g, ''); }
    function isValidPhone(p) { const d = normPhone(p); return d.length >= 9 && d.length <= 15 && !/^(\d)\1+$/.test(d); }
    function isValidEmail(e) { return !!(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim())); }
    function isRealName(n) {
      const c = String(n || '').trim();
      if (!c || c.length < 2) return false;
      if (BAD_NAMES.some(b => c.toLowerCase() === b)) return false;
      if (/^https?:\/\//i.test(c) || c.includes('@')) return false;
      return /[א-תa-zA-Z]/.test(c);
    }
    function extractUrl(...parts) {
      const text = parts.filter(Boolean).join(' ');
      const m = text.match(/https?:\/\/[^\s|,)>\]"']+/i);
      return m ? m[0].replace(/[)\]"'<>.,]+$/, '') : '';
    }

    let totalAdded = 0;
    let totalUpdated = 0;
    const perOwner = [];

    for (const settings of targets) {
      const ownerEmail = settings.ownerEmail;
      const sheetUrl = settings.sheetUrl;

      // Extract spreadsheet ID
      let spreadsheetId = null;
      const trimmed = sheetUrl.trim();
      const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (idMatch) spreadsheetId = idMatch[1];
      if (!spreadsheetId) continue;

      // Step 1: get all tab titles
      const metaResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaResp.ok) { console.warn(`Metadata fetch failed for ${ownerEmail}`); continue; }
      const meta = await metaResp.json();
      const tabs = (meta.sheets || []).map((s) => s.properties?.title).filter(Boolean);
      if (!tabs.length) continue;

      // Step 2: batch fetch all tabs
      const ranges = tabs.map(t => `ranges=${encodeURIComponent(`'${t}'!A1:Z1000`)}`).join('&');
      const valResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!valResp.ok) { console.warn(`Values fetch failed for ${ownerEmail}`); continue; }
      const valData = await valResp.json();
      const valueRanges = valData.valueRanges || [];

      // Step 3: dedup map (phone → lead, email → lead)
      const existingAll = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
      const phoneMap = {};
      const emailMap = {};
      for (const lead of existingAll) {
        const np = normPhone(lead.phone);
        if (np) phoneMap[np] = lead;
        if (lead.email) emailMap[String(lead.email).toLowerCase()] = lead;
      }

      let added = 0;
      let updated = 0;

      for (let t = 0; t < valueRanges.length; t++) {
        const tabRows = valueRanges[t]?.values || [];
        if (tabRows.length < 2) continue;

        const headers = tabRows[0].map(h => String(h || '').toLowerCase().trim());
        const idx = {
          name:   headers.findIndex(h => h.includes('name') || h.includes('שם')),
          phone:  headers.findIndex(h => h.includes('phone') || h.includes('טלפון') || h.includes('נייד')),
          email:  headers.findIndex(h => h.includes('email') || h.includes('מייל') || h.includes('דוא"ל')),
          source: headers.findIndex(h => h.includes('source') || h.includes('מקור') || h.includes('platform')),
          notes:  headers.findIndex(h => h.includes('note') || h.includes('הערות') || h.includes('הערה') || h.includes('message') || h.includes('הודעה')),
          type:   headers.findIndex(h => h.includes('type') || h.includes('סוג')),
          link:   headers.findIndex(h => h.includes('link') || h.includes('קישור') || h.includes('url')),
          address:headers.findIndex(h => h.includes('address') || h.includes('כתובת')),
        };

        if (idx.name === -1 && idx.phone === -1 && idx.email === -1) continue;

        for (let i = 1; i < tabRows.length; i++) {
          const row = tabRows[i];
          if (!row || row.every(c => !c || !String(c).trim())) continue;

          const g = (colIdx) => colIdx !== -1 ? String(row[colIdx] || '').trim() : '';
          const name    = g(idx.name);
          const phone   = g(idx.phone);
          const email   = g(idx.email);
          const source  = g(idx.source) || 'Google Sheets';
          const notes   = g(idx.notes);
          const type    = g(idx.type);
          const link    = g(idx.link);
          const address = g(idx.address);

          // Rule 1: must have real name + (phone OR email)
          if (!isRealName(name) || (!isValidPhone(phone) && !isValidEmail(email))) continue;

          // Rule 2: job board sources require an exact URL
          const sourceUrl = extractUrl(link, notes);
          const allText = [source, link, notes].join(' ').toLowerCase();
          if (JOB_BOARD_INDICATORS.some(k => allText.includes(k)) && !sourceUrl) continue;

          const cleanPhone = normPhone(phone);
          const cleanEmail = String(email).toLowerCase();

          // Dedup by phone or email
          const matchLead = (cleanPhone && phoneMap[cleanPhone]) || (email && emailMap[cleanEmail]);

          if (matchLead) {
            const updates = {};
            if (email && !matchLead.email) updates.email = email;
            if (!matchLead.source) updates.source = source;
            if (type && !matchLead.shooting_type) updates.shooting_type = type;
            if (address && !matchLead.address) updates.address = address;
            if (notes && !matchLead.notes) updates.notes = notes;
            if (phone && !matchLead.phone) updates.phone = phone;
            if (sourceUrl && !matchLead.source_post_url) updates.source_post_url = sourceUrl;
            if (Object.keys(updates).length > 0) {
              await base44.asServiceRole.entities.Lead.update(matchLead.id, updates);
              updated++;
            }
          } else {
            const created = await base44.asServiceRole.entities.Lead.create({
              name,
              phone: phone || undefined,
              email: email || undefined,
              source,
              source_post_url: sourceUrl || undefined,
              shooting_type: type || undefined,
              address: address || undefined,
              notes: notes || undefined,
              status: 'new',
              last_contact_date: new Date().toISOString(),
              is_filtered: false,
            });
            added++;
            if (cleanPhone) phoneMap[cleanPhone] = created;
            if (email) emailMap[cleanEmail] = created;
          }
        }
      }

      totalAdded += added;
      totalUpdated += updated;
      perOwner.push({ owner: ownerEmail, added, updated });
    }

    // Push notification when new leads are found
    if (totalAdded > 0) {
      try {
        await base44.asServiceRole.functions.invoke('sendPushNotification', {
          title: 'לידים חדשים 🎯',
          body: `${totalAdded} לידים חדשים נוספו מהסנכרון האוטומטי`,
        });
      } catch (_) { /* non-fatal */ }
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