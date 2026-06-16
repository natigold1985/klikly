import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sends a push notification to each photographer who has urgent (high priority)
// or overdue tasks that are due today or earlier.
// Triggered by a scheduled automation (daily at 08:00).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const endOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const allSettings = await base44.asServiceRole.entities.PhotographerSettings.list('-created_date', 500);
    const enabledSettings = allSettings.filter((s) => s.urgent_task_push_enabled !== false);

    let totalPushed = 0;
    const summary = [];

    for (const settings of enabledSettings) {
      const photographerEmail = settings.created_by;
      if (!photographerEmail) continue;

      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const allTasks = await base44.asServiceRole.entities.Task.filter(
        { created_by: photographerEmail, status: 'pending' },
        '-due_date',
        500
      );

      // Urgent: overdue OR due today OR due within 3 days (approaching deadline)
      const urgentToday = allTasks.filter((t) => {
        if (!t.due_date) return false;
        return t.due_date <= in3Days; // includes overdue + today + next 3 days
      });

      if (urgentToday.length === 0) continue;

      const overdue = urgentToday.filter(t => new Date(t.due_date) < now);
      const upcoming = urgentToday.filter(t => new Date(t.due_date) >= now);
      const title = overdue.length > 0 ? `🔥 ${overdue.length} משימות באיחור` : `⏰ ${upcoming.length} משימות מתקרבות לדדליין`;
      const body = urgentToday.length === 1
        ? urgentToday[0].title
        : `${urgentToday[0].title} ועוד ${urgentToday.length - 1} משימות`;

      try {
        await base44.asServiceRole.functions.invoke('sendPushNotification', {
          target_email: photographerEmail,
          title,
          body,
          url: '/Tasks',
        });
        totalPushed++;
        summary.push({ photographer: photographerEmail, tasks: urgentToday.length });

        // Also email if push subscription doesn't exist (fallback)
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: photographerEmail,
          subject: title,
          body: `<div style="font-family:Arial;direction:rtl;text-align:right">
            <h3>${title}</h3>
            <ul>${urgentToday.slice(0, 10).map((t) => `<li>${t.title}</li>`).join('')}</ul>
            <p><a href="${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/Tasks" style="background:#D4AF37;color:#000;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold">פתח משימות</a></p>
          </div>`,
        });
      } catch (e) {
        console.error('push failed for', photographerEmail, e);
      }
    }

    return Response.json({ ok: true, total_pushed: totalPushed, summary });
  } catch (error) {
    console.error('runUrgentTaskPush error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});