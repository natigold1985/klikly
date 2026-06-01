import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const TARGET_PHONES = new Set(['548090654', '0548090654', '0503683194']);

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function isGhostText(text) {
  const value = String(text || '').toLowerCase();
  return value.includes('לא ידוע') || value.includes('ליד ללא שם');
}

function isGhostRow(row) {
  const joined = (row || []).join(' ');
  if (isGhostText(joined)) return true;
  return (row || []).some((cell) => TARGET_PHONES.has(normalizePhone(cell)));
}

function isGhostLead(lead) {
  const phone = normalizePhone(lead.phone || lead.contact_info);
  const text = [lead.name, lead.title, lead.notes, lead.shooting_type, lead.source, lead.source_post_url, lead.snippet].filter(Boolean).join(' ');
  return isGhostText(text) || TARGET_PHONES.has(phone);
}

async function deleteRelated(base44, leadId) {
  const entities = [
    ['Activity', { related_to_id: leadId }],
    ['Task', { related_to_type: 'lead', related_to_id: leadId }],
    ['Reminder', { lead_id: leadId }],
  ];

  for (const [entityName, filter] of entities) {
    const records = await base44.asServiceRole.entities[entityName].filter(filter);
    for (const record of records) {
      await base44.asServiceRole.entities[entityName].delete(record.id);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 2000);
    const ghostLeads = allLeads.filter(isGhostLead);
    for (const lead of ghostLeads) {
      await deleteRelated(base44, lead.id);
      await base44.asServiceRole.entities.Lead.delete(lead.id);
    }

    const allPotential = await base44.asServiceRole.entities.PotentialLead.list('-created_date', 1000);
    const ghostPotential = allPotential.filter(isGhostLead);
    for (const lead of ghostPotential) {
      await base44.asServiceRole.entities.PotentialLead.delete(lead.id);
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const metadataResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metadataResp.ok) {
      const details = await metadataResp.text();
      return Response.json({ error: 'Failed to read sheet metadata', details }, { status: metadataResp.status });
    }

    const metadata = await metadataResp.json();
    const deleteRequests = [];
    const deletedBySheet = {};

    for (const sheet of metadata.sheets || []) {
      const { sheetId, title } = sheet.properties;
      const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:K2000`);
      const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!valuesResp.ok) continue;
      const valuesData = await valuesResp.json();
      const rows = valuesData.values || [];
      const rowsToDelete = [];
      for (let i = 1; i < rows.length; i++) {
        if (isGhostRow(rows[i])) rowsToDelete.push(i);
      }
      deletedBySheet[title] = rowsToDelete.length;
      rowsToDelete.sort((a, b) => b - a).forEach((rowIndex) => {
        deleteRequests.push({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        });
      });
    }

    let sheetRowsDeleted = 0;
    if (deleteRequests.length > 0) {
      const batchResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: deleteRequests }),
      });
      if (!batchResp.ok) {
        const details = await batchResp.text();
        return Response.json({ error: 'Failed to delete rows from Google Sheets', details }, { status: batchResp.status });
      }
      sheetRowsDeleted = deleteRequests.length;
    }

    return Response.json({
      success: true,
      leadsDeleted: ghostLeads.length,
      potentialDeleted: ghostPotential.length,
      sheetRowsDeleted,
      deletedBySheet,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});