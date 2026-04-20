import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type, projectId, leadId } = await req.json();

    let phone, name, message;

    if (type === 'payment_reminder' && projectId) {
      const project = await base44.entities.Project.get(projectId);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      phone = project.client_phone;
      name = project.client_name;
      const outstanding = (project.total_price || 0) - (project.payment_status === 'paid' ? project.total_price : 0);
      message = `היי ${name}, תזכורת ידידותית – נותר תשלום בסך ₪${outstanding.toLocaleString()} עבור הפרויקט. אשמח אם תוכל/י להסדיר. תודה!`;
    } else if (type === 'delivery_notification' && projectId) {
      const project = await base44.entities.Project.get(projectId);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      phone = project.client_phone;
      name = project.client_name;
      message = `היי ${name} 🎉 הגלריה שלך מוכנה! קיבלת קישור להורדת הקבצים. אשמח לשמוע מה חשבת!`;
    } else if (type === 'contract_reminder' && leadId) {
      const lead = await base44.entities.Lead.get(leadId);
      if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
      phone = lead.phone;
      name = lead.name;
      message = `היי ${name}, שלחתי לך הצעת מחיר לפני כמה ימים – רציתי לבדוק אם יש שאלות? אשמח לעזור!`;
    } else {
      return Response.json({ error: 'Invalid type or missing ID' }, { status: 400 });
    }

    if (!phone) return Response.json({ error: 'No phone number' }, { status: 400 });

    // Generate WhatsApp deep link
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const waLink = `https://wa.me/${israelPhone}?text=${encodeURIComponent(message)}`;

    // Log the action
    await base44.asServiceRole.entities.SystemLog.create({
      action: `WhatsApp ${type}`,
      details: `Generated WhatsApp link for ${name} (${phone}): ${type}`,
      status: 'success',
      related_entity_type: projectId ? 'Project' : 'Lead',
      related_entity_id: projectId || leadId,
      owner_id: user.email,
    });

    // Log activity
    await base44.entities.Activity.create({
      related_to_type: projectId ? 'project' : 'lead',
      related_to_id: projectId || leadId,
      activity_type: 'email_sent',
      title: `הודעת WhatsApp: ${type === 'payment_reminder' ? 'תזכורת תשלום' : type === 'delivery_notification' ? 'התראת משלוח' : 'תזכורת חוזה'}`,
      description: message,
    });

    return Response.json({ waLink, message, phone: israelPhone });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});