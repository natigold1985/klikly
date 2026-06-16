import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CLOSED_STATUS = 'נסגר בהצלחה';
const TIME_ZONE = 'Asia/Jerusalem';

function addOneDay(dateString) {
  const date = new Date(`${dateString}T00:00:00+03:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildEvent(lead) {
  const shootingDate = String(lead.event_date || '').slice(0, 10);
  const details = [
    `לקוח: ${lead.name || ''}`,
    lead.phone ? `טלפון: ${lead.phone}` : '',
    lead.email ? `מייל: ${lead.email}` : '',
    lead.shooting_type ? `סוג צילום: ${lead.shooting_type}` : '',
    lead.budget ? `תקציב: ₪${Number(lead.budget).toLocaleString('he-IL')}` : '',
    lead.source ? `מקור: ${lead.source}` : '',
    lead.source_post_url ? `קישור מקור: ${lead.source_post_url}` : '',
    lead.notes ? `הערות: ${lead.notes}` : '',
  ].filter(Boolean).join('\n');

  return {
    summary: `צילום ללקוח: ${lead.name || 'לקוח'}`,
    description: details,
    start: { date: shootingDate, timeZone: TIME_ZONE },
    end: { date: addOneDay(shootingDate), timeZone: TIME_ZONE },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 },
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 2 * 60 },
      ],
    },
    extendedProperties: {
      private: {
        source: 'klikly_lead_closed',
        lead_id: lead.id || '',
      },
    },
  };
}

async function upsertCalendarEvent(accessToken, lead, event) {
  const existingEventId = lead.google_calendar_event_id;
  if (existingEventId) {
    const patchResponse = await fetch(`${CALENDAR_API}/${existingEventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (patchResponse.ok) return patchResponse.json();
    if (patchResponse.status !== 404 && patchResponse.status !== 410) {
      throw new Error(`Google Calendar update failed: ${await patchResponse.text()}`);
    }
  }

  const createResponse = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!createResponse.ok) throw new Error(`Google Calendar create failed: ${await createResponse.text()}`);
  return createResponse.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const changedFields = payload.changed_fields || [];

    if (changedFields.length > 0 && changedFields.every((field) => field.startsWith('google_calendar_'))) {
      return Response.json({ success: true, skipped: 'calendar_metadata_update' });
    }

    const lead = payload.lead || payload.data;
    const oldLead = payload.old_data || {};
    if (!lead?.id) return Response.json({ success: true, skipped: 'no_lead' });
    if (lead.status !== CLOSED_STATUS) return Response.json({ success: true, skipped: 'not_closed' });
    if (oldLead.status === CLOSED_STATUS && !payload.force) return Response.json({ success: true, skipped: 'already_closed' });
    if (!lead.event_date) {
      await base44.asServiceRole.entities.SystemLog.create({
        action: 'lead_calendar_event_skipped',
        details: `הליד ${lead.name || lead.id} נסגר בהצלחה אך לא נוצר אירוע כי חסר תאריך צילום`,
        status: 'pending',
        related_entity_type: 'Lead',
        related_entity_id: lead.id,
      });
      return Response.json({ success: true, skipped: 'missing_event_date' });
    }

    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      accessToken = conn?.accessToken || conn?.access_token;
    } catch (_) {
      return Response.json({ success: true, skipped: 'calendar_not_connected' });
    }
    if (!accessToken) return Response.json({ success: true, skipped: 'calendar_not_connected' });

    const event = buildEvent(lead);
    const savedEvent = await upsertCalendarEvent(accessToken, lead, event);
    const syncedAt = new Date().toISOString();

    await base44.asServiceRole.entities.Lead.update(lead.id, {
      google_calendar_event_id: savedEvent.id,
      google_calendar_synced_at: syncedAt,
    });

    await base44.asServiceRole.entities.SystemLog.create({
      action: 'lead_calendar_event_created',
      details: JSON.stringify({ lead: lead.name, shooting_date: lead.event_date, calendar_event_id: savedEvent.id }),
      status: 'success',
      related_entity_type: 'Lead',
      related_entity_id: lead.id,
    });

    return Response.json({ success: true, eventId: savedEvent.id, calendarLink: savedEvent.htmlLink || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});