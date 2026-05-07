import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const HEADER_KEYS = {
    name:    ['name', 'שם', 'שם מלא', 'fullname', 'lead'],
    phone:   ['phone', 'טלפון', 'tel', 'mobile', 'נייד'],
    email:   ['email', 'מייל', 'דוא"ל', 'דואל', 'mail', 'e-mail'],
    source:  ['source', 'מקור', 'platform', 'פלטפורמה', 'ערוץ'],
    type:    ['type', 'סוג', 'סוג שירות', 'service', 'shoot type'],
    address: ['address', 'כתובת', 'city', 'עיר'],
    notes:   ['note', 'הערה', 'הערות', 'message', 'הודעה', 'תוכן הודעה', 'תיאור'],
    link:    ['link', 'קישור', 'url', 'source url', 'source_url', 'קישור מקור', 'קישור ליצירת קשר', 'קישור ליד'],
    company: ['company', 'חברה', 'תפקיד', 'role', 'job', 'position'],
    status:  ['סטטוס', 'status'],
};

function findColumnIndex(headers, keys) {
    for (let i = 0; i < headers.length; i++) {
        const h = (headers[i] || '').toLowerCase().trim();
        if (!h) continue;
        for (const k of keys) {
            if (h.includes(k.toLowerCase())) return i;
        }
    }
    return -1;
}

// Detect source from any text fragment (link, source column, notes, etc.)
function detectSource(...fragments) {
    const text = fragments.filter(Boolean).join(' ').toLowerCase();
    if (!text) return null;
    if (text.includes('linkedin')) return 'LinkedIn';
    if (text.includes('facebook') || text.includes('fb.com')) return 'Facebook';
    if (text.includes('instagram') || text.includes('ig.me') || text.includes('אינסטגרם')) return 'Instagram';
    if (text.includes('whatsapp') || text.includes('wa.me') || text.includes('וואטסאפ')) return 'WhatsApp';
    if (text.includes('google')) return 'Google Search';
    if (text.includes('ratigold.com') || text.includes('אתר')) return 'Website';
    if (text.includes('gmail') || text.includes('@') && text.includes('mail')) return 'Email';
    if (text.includes('המלצה') || text.includes('referral')) return 'המלצה';
    return null;
}

// Tab name → fallback source category
function tabNameToSource(tabName) {
    if (!tabName) return null;
    const t = tabName.toLowerCase();
    if (t.includes('אינסטגרם') || t.includes('instagram')) return 'Instagram';
    if (t.includes('פייסבוק') || t.includes('facebook')) return 'Facebook';
    if (t.includes('linkedin') || t.includes('לינקדאין')) return 'LinkedIn';
    if (t.includes('whatsapp') || t.includes('וואטסאפ')) return 'WhatsApp';
    if (t.includes('קורס')) return 'Course Lead';
    if (t.includes('ביטחון') || t.includes('ביטחו')) return 'Defense Industry';
    return null;
}

function isValidPhone(phone) {
    if (!phone) return false;
    const digits = String(phone).replace(/[^0-9]/g, '');
    return digits.length === 10 && !/^(\d)\1+$/.test(digits);
}

function isValidEmail(email) {
    return !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()));
}

function isFullName(name) {
    const clean = String(name || '').trim();
    const low = clean.toLowerCase();
    const bad = ['לא ידוע', 'unknown', 'test', 'בדיקה', 'n/a', '-', '?', 'ללא שם', 'ללא'];
    if (!clean || bad.includes(low)) return false;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    if (/מנהל|מנהלת|אחראי|אחראית|marcom|marketing|communications|manager|תפקיד|חברה|מחלקה/i.test(clean)) return false;
    return true;
}

function extractSourceUrl(...fragments) {
    const text = fragments.filter(Boolean).join(' ');
    const match = text.match(/https?:\/\/[^\s|,]+/i);
    return match ? match[0].replace(/[)\]"'<>]+$/g, '') : '';
}

function classifyPipeline(source = '', notes = '', shootingType = '') {
    const text = [source, notes, shootingType].join(' ').toLowerCase();
    if (/רפאל|אלביט|תעא|תעשייה אווירית|iai|rafael|elbit|defense|ביטחון|ביטחונית/.test(text)) {
        return { pipeline: 'defense_industry', pipeline_stage: 'lead_found' };
    }
    if (/webinar|וובינר|ai|בינה מלאכותית|תדמית ai/.test(text)) {
        return { pipeline: 'ai_webinar', pipeline_stage: 'registered_webinar' };
    }
    return { pipeline: 'events_b2b', pipeline_stage: 'quote_sent' };
}

// Detect junk/irrelevant leads — these should NOT be created as real leads.
function detectJunkLead(name, phone, email, source = '', notes = '', shootingType = '', sourceUrl = '') {
    const cleanName = String(name || '').trim();
    const text = [cleanName, source, notes, shootingType, sourceUrl].filter(Boolean).join(' ').toLowerCase();

    if (!isValidPhone(phone) && !isValidEmail(email)) {
        return { isJunk: true, reason: 'no_valid_contact_method' };
    }

    if (!isFullName(cleanName)) {
        return { isJunk: true, reason: 'invalid_full_name' };
    }

    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
        return { isJunk: true, reason: 'missing_source_url' };
    }

    if (text.includes('linkedin') && !isValidPhone(phone) && !isValidEmail(email)) {
        return { isJunk: true, reason: 'linkedin_without_real_contact' };
    }

    const junkTextPatterns = [
        'natigold.com/photography-course',
        'photography-course',
        'קורס צילום',
        'קורס',
        'הדרכה',
        'שבעה ימים להבין הכל',
        'אני נתי גולד',
        'צרו קשר',
        'עמוד נחיתה',
        'landing page',
        'facebook page',
        'פייסבוק page',
        'linkedin.com/jobs',
        'דרושים',
    ];
    if (junkTextPatterns.some(pattern => text.includes(pattern))) {
        return { isJunk: true, reason: 'marketing_or_non_person_lead' };
    }

    return { isJunk: false, reason: null };
}

function normPhone(p) {
    if (!p) return '';
    return String(p).replace(/[^0-9]/g, '');
}

function normalizeKey(s) {
    return String(s || '').trim().toLowerCase();
}

// ──────────────────────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Auth (optional — scheduled calls have no user)
        let userEmail = null;
        try {
            const user = await base44.auth.me();
            userEmail = user?.email;
        } catch (_) { /* scheduled */ }

        const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

        let body = {};
        try { body = await req.json(); } catch (_) { /* no body */ }
        const sheetUrl = body.sheetUrl;

        // Extract spreadsheet ID
        let spreadsheetId = null;
        if (sheetUrl) {
            const trimmed = sheetUrl.trim();
            let match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
            if (match) spreadsheetId = match[1];
            else {
                const segMatch = trimmed.match(/([a-zA-Z0-9_-]{20,})/);
                if (segMatch) spreadsheetId = segMatch[1];
            }
        }
        if (!spreadsheetId) {
            spreadsheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
        }

        // 1) Fetch spreadsheet metadata to discover ALL tabs
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
        const metaResp = await fetch(metaUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!metaResp.ok) {
            const errorText = await metaResp.text();
            return Response.json({ error: "Failed to load spreadsheet metadata", details: errorText }, { status: metaResp.status });
        }
        const meta = await metaResp.json();
        const tabs = (meta.sheets || []).map(s => s.properties?.title).filter(Boolean);

        if (!tabs.length) {
            return Response.json({ added: 0, updated: 0, message: "No tabs found" });
        }

        // 2) Batch fetch all tabs
        const ranges = tabs.map(t => `ranges=${encodeURIComponent(`'${t}'!A1:Z1000`)}`).join('&');
        const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`;
        const valuesResp = await fetch(valuesUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!valuesResp.ok) {
            const errorText = await valuesResp.text();
            return Response.json({ error: "Failed to fetch sheet values", details: errorText }, { status: valuesResp.status });
        }
        const valuesData = await valuesResp.json();
        const valueRanges = valuesData.valueRanges || [];

        // 3) Load existing leads for de-duplication.
        // We intentionally load ALL recent leads (not filtered by created_by),
        // because the same sheet can be synced by either the user OR a scheduled
        // service token, and both should de-duplicate against each other.
        const existing = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
        const phoneMap = {};
        const emailMap = {};
        const nameSourceMap = {};
        for (const lead of existing) {
            if (lead.phone) {
                const np = normPhone(lead.phone);
                if (np) phoneMap[np] = lead;
            }
            if (lead.email) emailMap[normalizeKey(lead.email)] = lead;
            if (lead.name) {
                const k = normalizeKey(lead.name) + '|' + normalizeKey(lead.source);
                nameSourceMap[k] = lead;
            }
        }

        let added = 0;
        let updated = 0;
        let skipped = 0;
        const perTab = [];
        const startTime = Date.now();
        const MAX_DURATION_MS = 50_000; // safety: stay under platform timeout

        // 4) Process each tab
        for (let t = 0; t < valueRanges.length; t++) {
            if (Date.now() - startTime > MAX_DURATION_MS) {
                perTab.push({ tab: tabs[t] || '?', error: 'time-budget-exhausted' });
                break;
            }
            const tabName = tabs[t] || `Tab${t}`;
            const rows = valueRanges[t]?.values || [];
            const tabFallbackSource = tabNameToSource(tabName);
            let tabAdded = 0, tabUpdated = 0, tabSkipped = 0;

            if (rows.length < 2) {
                perTab.push({ tab: tabName, added: 0, updated: 0, skipped: 0, note: 'empty' });
                continue;
            }

            const headers = rows[0];
            const idx = {
                name: findColumnIndex(headers, HEADER_KEYS.name),
                phone: findColumnIndex(headers, HEADER_KEYS.phone),
                email: findColumnIndex(headers, HEADER_KEYS.email),
                source: findColumnIndex(headers, HEADER_KEYS.source),
                type: findColumnIndex(headers, HEADER_KEYS.type),
                address: findColumnIndex(headers, HEADER_KEYS.address),
                notes: findColumnIndex(headers, HEADER_KEYS.notes),
                link: findColumnIndex(headers, HEADER_KEYS.link),
                company: findColumnIndex(headers, HEADER_KEYS.company),
            };

            // Need at least name OR phone OR email to make sense of a row
            if (idx.name === -1 && idx.phone === -1 && idx.email === -1) {
                perTab.push({ tab: tabName, added: 0, updated: 0, skipped: 0, note: 'no-recognizable-columns', headers });
                continue;
            }

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.every(c => !c || !String(c).trim())) continue;

                const name = idx.name !== -1 ? String(row[idx.name] || '').trim() : '';
                const phone = idx.phone !== -1 ? String(row[idx.phone] || '').trim() : '';
                const email = idx.email !== -1 ? String(row[idx.email] || '').trim() : '';
                const sourceCol = idx.source !== -1 ? String(row[idx.source] || '').trim() : '';
                const typeCol = idx.type !== -1 ? String(row[idx.type] || '').trim() : '';
                const addressCol = idx.address !== -1 ? String(row[idx.address] || '').trim() : '';
                const notesCol = idx.notes !== -1 ? String(row[idx.notes] || '').trim() : '';
                const linkCol = idx.link !== -1 ? String(row[idx.link] || '').trim() : '';
                const companyCol = idx.company !== -1 ? String(row[idx.company] || '').trim() : '';

                // Source detection: explicit column → link → notes → tab name
                const detectedSource =
                    detectSource(sourceCol) ||
                    detectSource(linkCol) ||
                    detectSource(notesCol) ||
                    sourceCol ||                        // raw value if non-empty
                    tabFallbackSource ||
                    'Google Sheets';

                // Compose notes (preserve link/company info)
                const notesParts = [];
                if (notesCol) notesParts.push(notesCol);
                if (companyCol) notesParts.push(`חברה/תפקיד: ${companyCol}`);
                if (linkCol) notesParts.push(`קישור: ${linkCol}`);
                const notes = notesParts.join(' | ');
                const sourceUrl = extractSourceUrl(linkCol, notesCol, sourceCol);

                const strictValidation = detectJunkLead(name, phone, email, detectedSource, notes, typeCol, sourceUrl);
                if (strictValidation.isJunk) { tabSkipped++; skipped++; continue; }

                // Find existing record by phone, then email, then name+source
                let match = null;
                const cleanPhone = normPhone(phone);
                if (cleanPhone && phoneMap[cleanPhone]) match = phoneMap[cleanPhone];
                if (!match && email && emailMap[normalizeKey(email)]) match = emailMap[normalizeKey(email)];
                if (!match && name) {
                    const k = normalizeKey(name) + '|' + normalizeKey(detectedSource);
                    if (nameSourceMap[k]) match = nameSourceMap[k];
                }

                if (match) {
                    const updates = {};
                    if (email && !match.email) updates.email = email;
                    if (detectedSource && !match.source) updates.source = detectedSource;
                    if (typeCol && !match.shooting_type) updates.shooting_type = typeCol;
                    if (addressCol && !match.address) updates.address = addressCol;
                    if (name && name !== match.name && !match.name?.includes(name)) updates.name = name;
                    if (notes && !match.notes) updates.notes = notes;
                    if (phone && !match.phone) updates.phone = phone;

                    if (Object.keys(updates).length > 0) {
                        await base44.asServiceRole.entities.Lead.update(match.id, updates);
                        tabUpdated++; updated++;
                        Object.assign(match, updates);
                    }
                } else {
                    const finalName = name;
                    const pipelineData = classifyPipeline(detectedSource, notes, typeCol);

                    const created = await base44.asServiceRole.entities.Lead.create({
                        name: finalName,
                        phone: phone || '',
                        email: email || undefined,
                        source: detectedSource,
                        source_post_url: sourceUrl,
                        shooting_type: typeCol || undefined,
                        address: addressCol || undefined,
                        notes: notes || undefined,
                        status: 'new',
                        pipeline: pipelineData.pipeline,
                        pipeline_stage: pipelineData.pipeline_stage,
                        last_contact_date: new Date().toISOString(),
                        is_filtered: false,
                    });
                    tabAdded++; added++;

                    // Track new keys to avoid duplicates within this run
                    if (cleanPhone) phoneMap[cleanPhone] = created;
                    if (email) emailMap[normalizeKey(email)] = created;
                    if (name) nameSourceMap[normalizeKey(name) + '|' + normalizeKey(detectedSource)] = created;
                }
            }

            perTab.push({ tab: tabName, added: tabAdded, updated: tabUpdated, skipped: tabSkipped });
        }

        return Response.json({
            success: true,
            spreadsheetId,
            tabs_count: tabs.length,
            added,
            updated,
            skipped,
            per_tab: perTab,
        });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});