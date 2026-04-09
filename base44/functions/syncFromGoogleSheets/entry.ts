import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
        
        const spreadsheetId = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
        const range = 'A:Z'; // Fetch all columns

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Sheets Error:", errorText);
            return Response.json({ error: "Failed to fetch from Google Sheets", details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            return Response.json({ message: "No data rows found" });
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('שם'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('טלפון'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('מייל') || h.includes('דוא"ל'));
        const sourceIdx = headers.findIndex(h => h.includes('source') || h.includes('מקור'));

        if (nameIdx === -1 || phoneIdx === -1) {
            return Response.json({ error: "Required columns (Name, Phone) not found", headers }, { status: 400 });
        }

        let addedCount = 0;
        let existingCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const name = row[nameIdx] || "";
            const phone = row[phoneIdx] || "";
            const email = emailIdx !== -1 ? row[emailIdx] : "";
            const source = sourceIdx !== -1 ? row[sourceIdx] : "Super Agent";

            if (!name || !phone) continue;

            const existingLeads = await base44.asServiceRole.entities.Lead.filter({ phone });
            
            if (existingLeads.length === 0) {
                await base44.asServiceRole.entities.Lead.create({
                    name,
                    phone,
                    email: email || undefined,
                    source: source || "Super Agent",
                    status: "new",
                    created_by: "natigold04@gmail.com"
                });
                addedCount++;
            } else {
                existingCount++;
            }
        }

        return Response.json({ success: true, added: addedCount, existing: existingCount, total_processed: rows.length - 1 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});