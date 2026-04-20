import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
        
        const spreadsheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
        const range = 'A:Z';

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ error: "Failed to fetch from Google Sheets", details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            return Response.json({ added: 0, updated: 0, message: "No data rows found" });
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('שם'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('טלפון'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('מייל') || h.includes('דוא"ל'));
        const sourceIdx = headers.findIndex(h => h.includes('source') || h.includes('מקור'));
        const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('סוג'));
        const addressIdx = headers.findIndex(h => h.includes('address') || h.includes('כתובת'));

        if (nameIdx === -1 || phoneIdx === -1) {
            return Response.json({ error: "Required columns (Name, Phone) not found", headers }, { status: 400 });
        }

        // Fetch existing leads for upsert (scoped to user)
        const existing = await base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 500);
        const phoneMap = {};
        for (const lead of existing) {
            if (lead.phone) phoneMap[lead.phone.replace(/[^0-9]/g, '')] = lead;
        }

        let added = 0;
        let updated = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const name = row[nameIdx] || "";
            const phone = row[phoneIdx] || "";
            const email = emailIdx !== -1 ? (row[emailIdx] || "") : "";
            const source = sourceIdx !== -1 ? (row[sourceIdx] || "") : "Google Sheets";
            const shootingType = typeIdx !== -1 ? (row[typeIdx] || "") : "";
            const address = addressIdx !== -1 ? (row[addressIdx] || "") : "";

            if (!name || !phone) continue;

            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const match = phoneMap[cleanPhone];
            
            if (match) {
                // Upsert: update non-empty fields that are currently empty
                const updates = {};
                if (email && !match.email) updates.email = email;
                if (source && !match.source) updates.source = source;
                if (shootingType && !match.shooting_type) updates.shooting_type = shootingType;
                if (address && !match.address) updates.address = address;
                if (name && name !== match.name) updates.name = name;

                if (Object.keys(updates).length > 0) {
                    await base44.entities.Lead.update(match.id, updates);
                    updated++;
                }
            } else {
                await base44.entities.Lead.create({
                    name,
                    phone,
                    email: email || undefined,
                    source: source || "Google Sheets",
                    shooting_type: shootingType || undefined,
                    address: address || undefined,
                    status: "new",
                    last_contact_date: new Date().toISOString(),
                });
                added++;
                // Track the new phone for remaining rows
                phoneMap[cleanPhone] = { phone, name, email, source };
            }
        }

        return Response.json({ success: true, added, updated, total_processed: rows.length - 1 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});