import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ADMIN_EMAIL = 'natigold04@gmail.com';
const MESSAGE = "Reminder: It's time to export your WhatsApp leads from JONI. Click here to import them.";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const importUrl = `${req.headers.get('origin') || ''}/LeadImport`;

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'joni_export_reminder',
      details: MESSAGE,
      status: 'success',
      related_entity_type: 'LeadImport',
      owner_id: ADMIN_EMAIL,
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject: 'JONI Leads Export Reminder',
      body: `${MESSAGE}\n\nImport Hub: ${importUrl}`,
    });

    return Response.json({ success: true, message: MESSAGE });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});