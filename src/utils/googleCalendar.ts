/**
 * Google Calendar API & OAuth 2.0 Integration for WORKSPACE
 * Handles Google Identity Services (GIS) token acquisition and 
 * Google Calendar API v3 event creation, updates, and sync.
 */

import { FutureShift, TimesheetEntry, GoogleCalendarAuthState } from '../types';
import { updateFutureShift, updateTimesheetEntry } from './storage';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_AUTH_STORAGE_KEY_PREFIX = 'workspace_google_cal_auth_';

/**
 * Fetch OAuth Client configuration from server
 */
export async function fetchGoogleOAuthConfig(): Promise<{
  configured: boolean;
  clientId: string;
  scopes: string[];
  message?: string;
}> {
  try {
    const res = await fetch('/api/oauth/config');
    if (!res.ok) {
      throw new Error(`Failed to load OAuth config: ${res.statusText}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error('Error fetching Google OAuth config:', err);
    return {
      configured: false,
      clientId: '',
      scopes: [CALENDAR_EVENTS_SCOPE],
      message: err.message || 'Network error fetching OAuth config'
    };
  }
}

/**
 * Get stored Google Calendar auth state for user
 */
export function getStoredGoogleCalendarAuth(username?: string): GoogleCalendarAuthState {
  const key = GOOGLE_AUTH_STORAGE_KEY_PREFIX + (username || 'default');
  const raw = localStorage.getItem(key);
  if (!raw) {
    // Check fallback legacy/global key
    const globalRaw = localStorage.getItem('workspace_google_cal_auth');
    if (globalRaw) {
      try {
        return JSON.parse(globalRaw);
      } catch {}
    }
    return {
      isConnected: false,
      accessToken: null,
      expiresAt: null,
      email: null,
      name: null,
      picture: null,
      calendarId: 'primary',
      autoSyncShifts: true,
      lastSyncTime: null
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      isConnected: false,
      accessToken: null,
      expiresAt: null,
      email: null,
      name: null,
      picture: null,
      calendarId: 'primary',
      autoSyncShifts: true,
      lastSyncTime: null
    };
  }
}

/**
 * Save Google Calendar auth state
 */
export function setStoredGoogleCalendarAuth(auth: GoogleCalendarAuthState, username?: string): void {
  const key = GOOGLE_AUTH_STORAGE_KEY_PREFIX + (username || 'default');
  localStorage.setItem(key, JSON.stringify(auth));
  localStorage.setItem('workspace_google_cal_auth', JSON.stringify(auth));
  window.dispatchEvent(new CustomEvent('google-calendar-auth-changed', { detail: auth }));
}

/**
 * Disconnect Google Calendar
 */
export function disconnectGoogleCalendar(username?: string): void {
  const empty: GoogleCalendarAuthState = {
    isConnected: false,
    accessToken: null,
    expiresAt: null,
    email: null,
    name: null,
    picture: null,
    calendarId: 'primary',
    autoSyncShifts: false,
    lastSyncTime: null
  };
  setStoredGoogleCalendarAuth(empty, username);
}

/**
 * Checks if token is valid and not expired
 */
export function isGoogleTokenValid(auth: GoogleCalendarAuthState): boolean {
  if (!auth.isConnected || !auth.accessToken) return false;
  if (!auth.expiresAt) return true;
  // Consider expired 1 minute early for safety
  return Date.now() < auth.expiresAt - 60000;
}

/**
 * Trigger Google OAuth popup flow using Google Identity Services (GIS)
 */
export async function connectGoogleCalendarAccount(clientId: string): Promise<GoogleCalendarAuthState> {
  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      'Google Identity Services client is not loaded. Please ensure your internet connection is active.'
    );
  }

  if (!clientId || clientId.trim() === '') {
    throw new Error(
      'Google OAuth Client ID is required. Please set GOOGLE_CLIENT_ID in your environment variables.'
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: clientId.trim(),
        scope: `${CALENDAR_EVENTS_SCOPE} https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile`,
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (!response.access_token) {
            reject(new Error('No access token returned from Google'));
            return;
          }

          const accessToken = response.access_token;
          const expiresIn = response.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          // Fetch primary calendar details & user info
          let email: string | null = null;
          let name: string | null = null;
          let picture: string | null = null;

          try {
            // Attempt to get user info
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              email = uData.email || null;
              name = uData.name || null;
              picture = uData.picture || null;
            }
          } catch (e) {
            console.warn('Could not fetch user info directly:', e);
          }

          try {
            // Check primary calendar access
            const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (calRes.ok) {
              const cData = await calRes.json();
              if (!email && cData.id) email = cData.id;
            }
          } catch (e) {
            console.warn('Could not fetch primary calendar:', e);
          }

          const authState: GoogleCalendarAuthState = {
            isConnected: true,
            accessToken,
            expiresAt,
            email: email || 'Google Account',
            name: name || 'Google User',
            picture,
            calendarId: 'primary',
            autoSyncShifts: true,
            lastSyncTime: new Date().toISOString()
          };

          resolve(authState);
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google OAuth prompt was cancelled or closed'));
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(new Error(err?.message || 'Failed to initialize Google OAuth Token Client'));
    }
  });
}

/**
 * Formats a Date and HH:MM time into an RFC3339 string with timezone offset
 * e.g. "2026-09-04T07:30:00-06:00"
 */
export function formatShiftTimeToRFC3339(dateStr: string, timeStr: string): string {
  // Normalize timeStr to HH:MM
  const cleanTime = (timeStr && timeStr.includes(':')) ? timeStr : '08:00';
  const [h, m] = cleanTime.split(':').map(Number);
  
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, h || 0, m || 0, 0, 0);

  // Get timezone offset in ±HH:mm
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMins = String(absOffset % 60).padStart(2, '0');
  const tzFormatted = `${sign}${offsetHours}:${offsetMins}`;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(h || 0)}:${pad(m || 0)}:00${tzFormatted}`;
}

/**
 * Builds Google Calendar Event payload from a FutureShift or TimesheetEntry
 */
export function buildCalendarEventPayload(shift: {
  project: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  locationName?: string;
  notes?: string;
  fullName?: string;
  username?: string;
}) {
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Edmonton';
  const startRFC = formatShiftTimeToRFC3339(shift.date, shift.startTime);
  const endRFC = formatShiftTimeToRFC3339(shift.date, shift.endTime);

  const loc = shift.location || shift.locationName || 'General Site';
  const project = shift.project || 'Work Shift';
  const assignee = shift.fullName || shift.username || 'Employee';

  const description = [
    `🏢 WORKSPACE Work Shift`,
    `----------------------------------------`,
    `👤 Staff / Assigned: ${assignee}`,
    `🔨 Active Task: ${project}`,
    `⏰ Scheduled Time: ${shift.startTime} – ${shift.endTime}`,
    `📍 Location: ${loc}`,
    shift.notes ? `📝 Details & Notes: ${shift.notes}` : null,
    `----------------------------------------`,
    `⚡ Synced automatically with WORKSPACE Operations`
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary: `Shift: ${project} (${shift.startTime} – ${shift.endTime})`,
    location: loc,
    description,
    start: {
      dateTime: startRFC,
      timeZone: userTimeZone
    },
    end: {
      dateTime: endRFC,
      timeZone: userTimeZone
    },
    colorId: '9', // Blueberry / Work Blue in Google Calendar palette
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }
      ]
    }
  };
}

/**
 * Creates an event on the user's primary Google Calendar
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  shift: FutureShift | TimesheetEntry,
  calendarId: string = 'primary'
): Promise<{ id: string; htmlLink: string }> {
  const payload = buildCalendarEventPayload(shift as any);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Google Calendar API error (${res.status}): ${res.statusText}`
    );
  }

  const data = await res.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink || `https://calendar.google.com/calendar/r/eventedit/${data.id}`
  };
}

/**
 * Updates an existing event on the user's primary Google Calendar
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  shift: FutureShift | TimesheetEntry,
  calendarId: string = 'primary'
): Promise<{ id: string; htmlLink: string }> {
  const payload = buildCalendarEventPayload(shift as any);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (res.status === 404) {
    // Event was deleted in Google Calendar, re-create it
    return createGoogleCalendarEvent(accessToken, shift, calendarId);
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Failed to update Calendar event (${res.status}): ${res.statusText}`
    );
  }

  const data = await res.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink || `https://calendar.google.com/calendar/r/eventedit/${data.id}`
  };
}

/**
 * Deletes an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return res.ok || res.status === 404;
  } catch (e) {
    console.error('Error deleting event from Google Calendar:', e);
    return false;
  }
}

/**
 * Syncs a single FutureShift to Google Calendar and updates stored record
 */
export async function syncFutureShiftToGoogleCalendar(
  shift: FutureShift,
  auth: GoogleCalendarAuthState
): Promise<FutureShift> {
  if (!isGoogleTokenValid(auth) || !auth.accessToken) {
    throw new Error('Google Calendar is not connected or session expired');
  }

  let eventInfo: { id: string; htmlLink: string };
  if (shift.googleCalendarEventId) {
    eventInfo = await updateGoogleCalendarEvent(
      auth.accessToken,
      shift.googleCalendarEventId,
      shift,
      auth.calendarId || 'primary'
    );
  } else {
    eventInfo = await createGoogleCalendarEvent(
      auth.accessToken,
      shift,
      auth.calendarId || 'primary'
    );
  }

  const updatedShift: FutureShift = {
    ...shift,
    googleCalendarEventId: eventInfo.id,
    googleCalendarHtmlLink: eventInfo.htmlLink,
    lastSyncedToCalendar: new Date().toISOString()
  };

  updateFutureShift(updatedShift);
  return updatedShift;
}

/**
 * Syncs a TimesheetEntry to Google Calendar
 */
export async function syncTimesheetEntryToGoogleCalendar(
  entry: TimesheetEntry,
  auth: GoogleCalendarAuthState
): Promise<TimesheetEntry> {
  if (!isGoogleTokenValid(auth) || !auth.accessToken) {
    throw new Error('Google Calendar is not connected or session expired');
  }

  let eventInfo: { id: string; htmlLink: string };
  if (entry.googleCalendarEventId) {
    eventInfo = await updateGoogleCalendarEvent(
      auth.accessToken,
      entry.googleCalendarEventId,
      entry,
      auth.calendarId || 'primary'
    );
  } else {
    eventInfo = await createGoogleCalendarEvent(
      auth.accessToken,
      entry,
      auth.calendarId || 'primary'
    );
  }

  const updatedEntry: TimesheetEntry = {
    ...entry,
    googleCalendarEventId: eventInfo.id,
    googleCalendarHtmlLink: eventInfo.htmlLink,
    lastSyncedToCalendar: new Date().toISOString()
  };

  updateTimesheetEntry(updatedEntry);
  return updatedEntry;
}

/**
 * Sync all future shifts for a user to Google Calendar
 */
export async function syncAllFutureShifts(
  shifts: FutureShift[],
  auth: GoogleCalendarAuthState,
  username?: string
): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
  if (!isGoogleTokenValid(auth) || !auth.accessToken) {
    throw new Error('Google Calendar session is expired. Please reconnect.');
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const shift of shifts) {
    try {
      await syncFutureShiftToGoogleCalendar(shift, auth);
      successCount++;
    } catch (err: any) {
      failedCount++;
      errors.push(`Shift on ${shift.date} (${shift.project}): ${err.message}`);
    }
  }

  // Update last sync time
  const updatedAuth = {
    ...auth,
    lastSyncTime: new Date().toISOString()
  };
  setStoredGoogleCalendarAuth(updatedAuth, username);

  return { successCount, failedCount, errors };
}
