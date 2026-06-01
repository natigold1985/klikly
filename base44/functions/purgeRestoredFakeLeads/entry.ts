import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4';
const RESTORE_SERVICE_EMAIL = 'service+3dba0040-0d1b-4e5a-90f6-87e498bdb326@no-reply.base44.com';
const RESTORE_START = new Date('2026-06-01T12:57:50.000Z').getTime();

function value(record, key) {
  return record?.[key] ?? record?.data?.[key] ?? '';
}

function createdTime(record) {
  return new Date(record.created_date || record.createdDate || 0).getTime();
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function phoneDigits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function isRestoredLead(record) {
  return record?.created_by === RESTORE_SERVICE_EMAIL && createdTime(record) >= RESTORE_START;
}

function rowMatches(row, records) {
  const rowText = (row || []).join(' ').toLowerCase();
  return records.some((record) => {
    const phone = phoneDigits(value(record, 'phone') || value(record, 'contact_info'));
    const email = normalize(value(record, 'email'));
    const name = normalize(value(record, 'name') || value(record, 'title'));
    const url = normalize(value(record, 'source_post_url') || value(record, 'source_url'));

    if (phone && (row || []).some((cell) => {
      const cellPhone = phoneDigits(cell);
      return cellPhone && (cellPhone.includes(phone) || phone.includes(cellPhone));
    })) return true;
    if (email && rowText.includes(email)) return true;
    if (url && rowText.includes(url)) return true;
    if (name && name.length > 3 && rowText.includes(name)) return true;
    return false;
  });
}

async function listAll(base44, entityName, limit = 500) {
  return await base44.asServiceRole.entities[entityName].list('-created_date', limit);
}

async function deleteRecords(base44, entityName, records) {
  let deleted = 0;
  for (const record of records) {
    await base44.asServiceRole.entities[entityName].delete(record.id);
    deleted++;
  }
  return deleted;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const leads = (await listAll(base44, 'Lead', 300)).filter(isRestoredLead);
    const potentialLeads = (await listAll(base44, 'PotentialLead', 300)).filter((record) => {
      return isRestoredLead(record) && normalize(value(record, 'notes')).includes('שוחזר מ-claude code');
    });
    const recordsForSheet = [...leads, ...potentialLeads];

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResp.ok) return Response.json({ error: 'Failed to read sheet metadata', details: await metaResp.text() }, { status: metaResp.status });

    const metadata = await metaResp.json();
    const requests = [];
    const deletedBySheet = {};

    for (const sheet of metadata.sheets || []) {
      const { sheetId, title } = sheet.properties;
      const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:Z2000`);
      const valuesResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!valuesResp.ok) continue;
      const rows = (await valuesResp.json()).values || [];
      const rowsToDelete = [];
      for (let i = 1; i < rows.length; i++) {
        if (rowMatches(rows[i], recordsForSheet)) rowsToDelete.push(i);
      }
      deletedBySheet[title] = rowsToDelete.length;
      rowsToDelete.sort((a, b) => b - a).forEach((rowIndex) => {
        requests.push({
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        });
      });
    }

    if (!dryRun && requests.length > 0) {
      const batchResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      if (!batchResp.ok) return Response.json({ error: 'Failed to delete sheet rows', details: await batchResp.text() }, { status: batchResp.status });
    }

    const leadsDeleted = dryRun ? 0 : await deleteRecords(base44, 'Lead', leads);
    const potentialDeleted = dryRun ? 0 : await deleteRecords(base44, 'PotentialLead', potentialLeads);

    return Response.json({
      success: true,
      dryRun,
      matchedLeads: leads.length,
      matchedPotentialLeads: potentialLeads.length,
      sheetRowsMatched: requests.length,
      deletedBySheet,
      leadsDeleted,
      potentialDeleted,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});