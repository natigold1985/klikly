import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function getAccessToken(base44) {
  const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  return conn?.accessToken || conn?.access_token || null;
}

async function deleteCalendarEvent(accessToken, eventId) {
  if (!eventId) return { deleted: false };
  const response = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404 || response.status === 410) return { deleted: true, missing: true };
  if (!response.ok) throw new Error(`Google Calendar delete failed: ${await response.text()}`);
  return { deleted: true };
}

function buildCalendarEvent(task) {
  const due = new Date(task.due_date);
  const end = new Date(due.getTime() + 60 * 60 * 1000);
  const isHigh = task.priority === 'high';

  return {
    summary: `${isHigh ? '🔥 דחוף: ' : 'משימה: '}${task.title}`,
    description: task.description || '',
    start: { dateTime: due.toISOString(), timeZone: 'Asia/Jerusalem' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Jerusalem' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 60 },
      ],
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const changedFields = payload.changed_fields || [];

    if (changedFields.length > 0 && changedFields.every((field) => field.startsWith('google_calendar_'))) {
      return Response.json({ success: true, skipped: 'calendar_metadata_update' });
    }

    const action = payload.action || payload.event?.type || 'sync';
    const task = payload.task || payload.data || payload.old_data;

    if (action === 'sync_all') {
      let accessToken;
      try {
        accessToken = await getAccessToken(base44);
      } catch (_) {
        return Response.json({ success: true, skipped: 'calendar_not_connected' });
      }
      if (!accessToken) return Response.json({ success: true, skipped: 'calendar_not_connected' });

      const tasks = await base44.asServiceRole.entities.Task.list('-updated_date', 1000);
      let synced = 0;
      let removed = 0;
      for (const item of tasks) {
        if (item.status === 'completed' || !item.due_date) {
          if (item.google_calendar_event_id) {
            await deleteCalendarEvent(accessToken, item.google_calendar_event_id);
            await base44.asServiceRole.entities.Task.update(item.id, {
              google_calendar_event_id: null,
              google_calendar_synced_at: new Date().toISOString(),
            });
            removed++;
          }
          continue;
        }

        const event = buildCalendarEvent(item);
        const hasEvent = !!item.google_calendar_event_id;
        const response = await fetch(hasEvent ? `${CALENDAR_API}/${item.google_calendar_event_id}` : CALENDAR_API, {
          method: hasEvent ? 'PATCH' : 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        if (!response.ok) throw new Error(`Google Calendar sync failed: ${await response.text()}`);
        const data = await response.json();
        await base44.asServiceRole.entities.Task.update(item.id, {
          google_calendar_event_id: data.id,
          google_calendar_synced_at: new Date().toISOString(),
        });
        synced++;
      }
      return Response.json({ success: true, action: 'sync_all', synced, removed });
    }

    if (!task) return Response.json({ success: true, skipped: 'no_task' });

    if (task.google_calendar_synced_at && task.updated_date) {
      const syncTime = new Date(task.google_calendar_synced_at).getTime();
      const updateTime = new Date(task.updated_date).getTime();
      if (Math.abs(updateTime - syncTime) < 15000 && action !== 'delete') {
        return Response.json({ success: true, skipped: 'recent_calendar_metadata_update' });
      }
    }

    let accessToken;
    try {
      accessToken = await getAccessToken(base44);
    } catch (_) {
      return Response.json({ success: true, skipped: 'calendar_not_connected' });
    }
    if (!accessToken) return Response.json({ success: true, skipped: 'calendar_not_connected' });

    if (action === 'delete' || task.status === 'completed' || !task.due_date) {
      await deleteCalendarEvent(accessToken, task.google_calendar_event_id);
      if (task.id && action !== 'delete' && task.google_calendar_event_id) {
        await base44.asServiceRole.entities.Task.update(task.id, {
          google_calendar_event_id: null,
          google_calendar_synced_at: new Date().toISOString(),
        });
      }
      return Response.json({ success: true, action: 'calendar_event_removed' });
    }

    const event = buildCalendarEvent(task);
    const hasEvent = !!task.google_calendar_event_id;
    const response = await fetch(hasEvent ? `${CALENDAR_API}/${task.google_calendar_event_id}` : CALENDAR_API, {
      method: hasEvent ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) throw new Error(`Google Calendar sync failed: ${await response.text()}`);
    const data = await response.json();

    if (task.id) {
      await base44.asServiceRole.entities.Task.update(task.id, {
        google_calendar_event_id: data.id,
        google_calendar_synced_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, eventId: data.id, action: hasEvent ? 'updated' : 'created' });
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('no active connection')) {
      return Response.json({ success: true, skipped: 'calendar_not_connected' });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});