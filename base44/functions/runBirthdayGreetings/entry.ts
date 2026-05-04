import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily scheduled function: sends birthday greetings + discount coupon
// to existing clients (Contact with type="client" and birthday today).
// Sends both Email + WhatsApp link reminder for the photographer.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const currentYear = today.getFullYear();

    // Get all contacts
    const contacts = await base44.asServiceRole.entities.Contact.list();

    const birthdayContacts = contacts.filter((c) => {
      if (!c.birthday || !c.birthday_greeting_consent) return false;
      const bd = new Date(c.birthday);
      const matchesToday =
        bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay;
      const notGreetedThisYear = c.last_birthday_greeting_year !== currentYear;
      return matchesToday && notGreetedThisYear;
    });

    if (birthdayContacts.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'אין ימי הולדת היום' });
    }

    // Get business name from settings
    const settings = await base44.asServiceRole.entities.PhotographerSettings.list();
    const businessName = settings[0]?.business_name || 'הצלם שלך';
    const photographerEmail = settings[0]?.email || '';

    let emailsSent = 0;
    let whatsappTasksCreated = 0;
    const errors = [];

    for (const contact of birthdayContacts) {
      const couponCode = `BDAY${currentYear}${contact.id.slice(-4).toUpperCase()}`;
      const firstName = (contact.name || '').split(' ')[0] || '';

      // 1. Send Email greeting (if email available)
      if (contact.email) {
        try {
          const emailBody = `
שלום ${firstName} 🎉

יום הולדת שמח מכל הלב!

רצינו להודות לך על שבחרת בנו, ולפנק אותך בקופון מתנה ליום הולדתך:

🎁 קוד קופון: ${couponCode}
🎁 הנחה של 15% על הצילום הבא שלך
🎁 בתוקף עד סוף החודש

מצפים לראותך שוב!

בברכה,
${businessName}
          `.trim();

          await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: businessName,
            to: contact.email,
            subject: `🎂 יום הולדת שמח, ${firstName}! מתנה בפנים`,
            body: emailBody
          });
          emailsSent++;
        } catch (err) {
          errors.push(`email ${contact.email}: ${err.message}`);
        }
      }

      // 2. Create a Task to remind the photographer to send WhatsApp greeting
      if (contact.phone) {
        try {
          await base44.asServiceRole.entities.Task.create({
            title: `🎂 לשלוח ברכת יום הולדת ל-${contact.name}`,
            description: `קופון: ${couponCode} (15% הנחה)\nטלפון: ${contact.phone}\nשלח ברכה אישית ב-WhatsApp.`,
            due_date: new Date().toISOString(),
            priority: 'high',
            stage: 'general',
            status: 'pending'
          });
          whatsappTasksCreated++;
        } catch (err) {
          errors.push(`task ${contact.name}: ${err.message}`);
        }
      }

      // Mark as greeted this year
      await base44.asServiceRole.entities.Contact.update(contact.id, {
        last_birthday_greeting_year: currentYear
      });

      // Log activity
      try {
        await base44.asServiceRole.entities.Activity.create({
          related_to_type: 'project',
          related_to_id: contact.id,
          activity_type: 'email_sent',
          title: `ברכת יום הולדת + קופון ${couponCode}`,
          description: `נשלח ל-${contact.name}`
        });
      } catch (e) { /* ignore activity errors */ }
    }

    return Response.json({
      success: true,
      birthdays_today: birthdayContacts.length,
      emails_sent: emailsSent,
      whatsapp_tasks_created: whatsappTasksCreated,
      errors
    });
  } catch (error) {
    console.error('runBirthdayGreetings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});