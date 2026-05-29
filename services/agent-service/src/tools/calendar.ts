import { google } from 'googleapis';
import { DateTime } from 'luxon';
import { logger } from '../lib/logger';

const getCalendarClient = (profile: any) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Use profile tokens if available, otherwise fall back to env
  const tokens = profile?.google_tokens && Object.keys(profile.google_tokens).length > 0
    ? profile.google_tokens
    : { refresh_token: process.env.GOOGLE_REFRESH_TOKEN };

  oauth2Client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

export const calendarTools = [
  {
    name: 'create_calendar_event',
    description: 'Creates a new Google Calendar event',
    schema: {
      type: 'object',
      required: ['title', 'start_time', 'end_time'],
      properties: {
        title:       { type: 'string', description: 'Event title' },
        start_time:  { type: 'string', description: 'ISO 8601 datetime' },
        end_time:    { type: 'string', description: 'ISO 8601 datetime' },
        description: { type: 'string' },
        location:    { type: 'string' },
        attendees:   { type: 'array', items: { type: 'string', description: 'email' } },
        timezone:    { type: 'string', default: 'Asia/Kolkata' },
      },
    },
    handler: async (params: any, profile: any) => {
      const calendar = getCalendarClient(profile);
      const tz = params.timezone || profile?.timezone || 'Asia/Kolkata';

      const event = {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: { dateTime: params.start_time, timeZone: tz },
        end:   { dateTime: params.end_time,   timeZone: tz },
        attendees: params.attendees?.map((email: string) => ({ email })) || [],
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      logger.info('Calendar event created', { id: response.data.id });
      return {
        id: response.data.id,
        title: response.data.summary,
        start: response.data.start?.dateTime,
        end:   response.data.end?.dateTime,
        link:  response.data.htmlLink,
      };
    },
  },

  {
    name: 'fetch_calendar_events',
    description: 'Fetches upcoming calendar events',
    schema: {
      type: 'object',
      properties: {
        from:        { type: 'string', description: 'ISO 8601 start date (default: now)' },
        to:          { type: 'string', description: 'ISO 8601 end date (default: +7 days)' },
        max_results: { type: 'integer', default: 10 },
      },
    },
    handler: async (params: any, profile: any) => {
      const calendar = getCalendarClient(profile);
      const tz = profile?.timezone || 'Asia/Kolkata';
      const now = DateTime.now().setZone(tz);

      const timeMin = params.from || now.toISO();
      const timeMax = params.to  || now.plus({ days: 7 }).toISO();

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults: params.max_results || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response.data.items || []).map(e => ({
        id:       e.id,
        title:    e.summary,
        start:    e.start?.dateTime || e.start?.date,
        end:      e.end?.dateTime   || e.end?.date,
        location: e.location,
        link:     e.htmlLink,
      }));

      logger.info('Calendar events fetched', { count: events.length });
      return { events, count: events.length };
    },
  },

  {
    name: 'delete_calendar_event',
    description: 'Deletes a calendar event by ID',
    schema: {
      type: 'object',
      required: ['event_id'],
      properties: {
        event_id: { type: 'string', description: 'Google Calendar event ID' },
      },
    },
    handler: async (params: any, profile: any) => {
      const calendar = getCalendarClient(profile);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: params.event_id,
      });

      logger.info('Calendar event deleted', { id: params.event_id });
      return { success: true, deletedId: params.event_id };
    },
  },
];
