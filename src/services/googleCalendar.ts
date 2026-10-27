/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { FutureShift } from '../types';
import { TimeOffRequest, addSecurityLog } from '../utils/storage';

export type CalendarErrorCode = 
  | 'POPUP_BLOCKED'
  | 'POPUP_CLOSED'
  | 'CONCURRENT_REQUEST'
  | 'ACCESS_DENIED'
  | 'NETWORK_ERROR'
  | 'AUTH_UNAUTHORIZED_DOMAIN'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CALENDAR_NOT_FOUND'
  | 'IFRAME_RESTRICTION'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

export interface CalendarErrorDetails {
  code: CalendarErrorCode;
  rawCode?: string;
  title: string;
  message: string;
  actionHint: string;
  isRetryable: boolean;
  popupBlockedHelp?: boolean;
  rawError?: string;
}

export interface GoogleCalendarProfile {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  timeZone?: string;
}

export interface CalendarConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  lastSyncTime: string | null;
  selectedCalendarId: string;
  availableCalendars: GoogleCalendarProfile[];
  error: CalendarErrorDetails | null;
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

const STORAGE_KEY_CALENDAR_META = 'workspace_google_calendar_meta';

// In-memory token storage (MANDATORY per workspace integration guidelines)
let cachedAccessToken: string | null = null;
let currentFirebaseUser: User | null = null;

// Persistent non-sensitive metadata (never stores the access token!)
interface StoredCalendarMeta {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  lastSyncTime: string | null;
  selectedCalendarId: string;
}

function loadStoredMeta(): StoredCalendarMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CALENDAR_META);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse calendar metadata:', e);
  }
  return {
    isConnected: false,
    userEmail: null,
    userName: null,
    userPhoto: null,
    lastSyncTime: null,
    selectedCalendarId: 'primary'
  };
}

function saveStoredMeta(meta: Partial<StoredCalendarMeta>) {
  try {
    const current = loadStoredMeta();
    const updated = { ...current, ...meta };
    localStorage.setItem(STORAGE_KEY_CALENDAR_META, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save calendar metadata:', e);
  }
}

// Current reactive state
const stored = loadStoredMeta();
let state: CalendarConnectionState = {
  isConnected: stored.isConnected,
  isConnecting: false,
  isSyncing: false,
  userEmail: stored.userEmail,
  userName: stored.userName,
  userPhoto: stored.userPhoto,
  lastSyncTime: stored.lastSyncTime,
  selectedCalendarId: stored.selectedCalendarId || 'primary',
  availableCalendars: [],
  error: null
};

// Listeners
type StateListener = (state: CalendarConnectionState) => void;
const listeners = new Set<StateListener>();

export function subscribeCalendarState(listener: StateListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

function notifyStateChanged() {
  const snapshot = { ...state };
  listeners.forEach(fn => {
    try {
      fn(snapshot);
    } catch (e) {
      console.error('Error in calendar state listener:', e);
    }
  });

  // Broadcast window event
  window.dispatchEvent(new CustomEvent('workspace-calendar-status', { detail: snapshot }));
}

/**
 * Robust error categorization for all Firebase Auth & Google Calendar REST errors
 */
export function parseCalendarError(err: any): CalendarErrorDetails {
  const rawCode = err?.code || (err?.status ? `HTTP_${err.status}` : 'UNKNOWN');
  const rawMessage = err?.message || String(err);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  // 1. Popup Blocked
  if (
    rawCode === 'auth/popup-blocked' ||
    rawMessage.toLowerCase().includes('popup blocked') ||
    rawMessage.toLowerCase().includes('popup window')
  ) {
    return {
      code: 'POPUP_BLOCKED',
      rawCode,
      title: 'Popup Blocked by Browser',
      message: 'Your browser prevented the Google Sign-In popup from opening.',
      actionHint: 'Look for a blocked popup icon in your URL address bar (usually a small icon with a red X on the right side). Click it, select "Always allow popups from this site", and click Try Again.',
      isRetryable: true,
      popupBlockedHelp: true,
      rawError: rawMessage
    };
  }

  // 2. Popup Closed by User
  if (
    rawCode === 'auth/popup-closed-by-user' ||
    rawMessage.toLowerCase().includes('closed-by-user') ||
    rawMessage.toLowerCase().includes('user closed the popup')
  ) {
    return {
      code: 'POPUP_CLOSED',
      rawCode,
      title: 'Sign-In Canceled',
      message: 'The Google Calendar sign-in popup was closed before completing authorization.',
      actionHint: 'No changes were made. When you are ready, click Connect Google Calendar and complete the Google consent screen.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 3. Concurrent Request
  if (
    rawCode === 'auth/cancelled-popup-request' ||
    rawMessage.toLowerCase().includes('cancelled-popup-request')
  ) {
    return {
      code: 'CONCURRENT_REQUEST',
      rawCode,
      title: 'Previous Request Canceled',
      message: 'A previous Google authentication prompt was already active.',
      actionHint: 'The previous request was cleared. You can now click Connect again.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 4. Access Denied / Consent Refused / Missing Permissions
  if (
    rawCode === 'auth/access-denied' ||
    rawMessage.toLowerCase().includes('access_denied') ||
    rawMessage.toLowerCase().includes('insufficient authentication scopes') ||
    rawMessage.toLowerCase().includes('permission_denied') ||
    err?.status === 403
  ) {
    return {
      code: 'ACCESS_DENIED',
      rawCode,
      title: 'Calendar Permission Not Granted',
      message: 'Google Calendar requires permission to view and sync schedule events to your account.',
      actionHint: 'During the Google Sign-In prompt, make sure to check the box granting WORKSPACE permission to "See, edit, share, and permanently delete all the calendars you can access using Google Calendar".',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 5. Network Request Failed / Offline
  if (
    rawCode === 'auth/network-request-failed' ||
    rawMessage.toLowerCase().includes('network-request-failed') ||
    rawMessage.toLowerCase().includes('failed to fetch') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return {
      code: 'NETWORK_ERROR',
      rawCode,
      title: 'Network Connection Offline',
      message: 'Unable to contact Google authentication or Calendar services.',
      actionHint: 'Please check your internet connection and try connecting again.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 6. Token Expired / 401 Unauthorized
  if (
    err?.status === 401 ||
    rawMessage.toLowerCase().includes('401') ||
    rawMessage.toLowerCase().includes('invalid credentials') ||
    rawMessage.toLowerCase().includes('token expired')
  ) {
    return {
      code: 'TOKEN_EXPIRED',
      rawCode,
      title: 'Google Session Expired',
      message: 'Your Google Calendar authorization session has expired.',
      actionHint: 'Click Reconnect Google Calendar to refresh your secure connection token.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 7. Rate Limit Exceeded
  if (
    err?.status === 429 ||
    rawMessage.toLowerCase().includes('ratelimitexceeded') ||
    rawMessage.toLowerCase().includes('quota exceeded')
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      rawCode,
      title: 'Google Calendar Rate Limit',
      message: 'Google Calendar API rate limit reached.',
      actionHint: 'Google has temporarily rate-limited API calls. Please wait a minute before syncing again.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // 8. Unauthorized domain
  if (
    rawCode === 'auth/unauthorized-domain' ||
    rawMessage.toLowerCase().includes('unauthorized domain')
  ) {
    return {
      code: 'AUTH_UNAUTHORIZED_DOMAIN',
      rawCode,
      title: 'Preview Domain Not Authorized',
      message: 'The current app domain is not yet listed in the Firebase/OAuth authorized domains list.',
      actionHint: 'Contact your administrator or add this domain to Firebase Console > Authentication > Settings > Authorized domains.',
      isRetryable: false,
      rawError: rawMessage
    };
  }

  // 9. Iframe sandboxing restrictions
  if (isEmbedded && (rawMessage.toLowerCase().includes('sandbox') || rawMessage.toLowerCase().includes('restricted'))) {
    return {
      code: 'IFRAME_RESTRICTION',
      rawCode,
      title: 'Embedded Browser Restriction',
      message: 'Google authentication popups may be restricted inside an embedded preview iframe.',
      actionHint: 'Click "Open App in Separate Window / Tab" to complete Google Calendar authentication safely.',
      isRetryable: true,
      rawError: rawMessage
    };
  }

  // Generic fallback
  return {
    code: 'UNKNOWN_ERROR',
    rawCode,
    title: 'Calendar Connection Error',
    message: rawMessage || 'An unexpected error occurred while connecting to Google Calendar.',
    actionHint: 'Please click Try Again. If the problem persists, check browser popup and cookie permissions.',
    isRetryable: true,
    rawError: rawMessage
  };
}

/**
 * Initialize Auth State Listener
 */
export function initGoogleCalendarAuth(): () => void {
  try {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      currentFirebaseUser = user;
      if (!user) {
        // If Firebase signs out, purge the in-memory token
        cachedAccessToken = null;
        if (state.isConnected && !loadStoredMeta().isConnected) {
          state.isConnected = false;
          state.userEmail = null;
          state.userName = null;
          state.userPhoto = null;
          notifyStateChanged();
        }
      }
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not initialize Google Calendar auth listener:', e);
    return () => {};
  }
}

/**
 * Get current in-memory access token
 */
export function getCalendarAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Primary Google Calendar Connection Flow with Resilient Error Handling
 */
export async function connectGoogleCalendar(): Promise<{ success: boolean; error?: CalendarErrorDetails }> {
  // Reset previous error
  state.isConnecting = true;
  state.error = null;
  notifyStateChanged();

  try {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    
    // Add required calendar scopes
    SCOPES.forEach(s => provider.addScope(s));
    
    // Custom parameters to ensure consent and account selection
    provider.setCustomParameters({
      prompt: 'select_account consent',
      access_type: 'online'
    });

    // Execute popup
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Google did not return an access token for Calendar API.');
    }

    // Cache access token IN-MEMORY only (NEVER localStorage per guidelines)
    cachedAccessToken = credential.accessToken;
    currentFirebaseUser = result.user;

    // Fetch user calendar profile to verify token permissions
    const calendars = await fetchUserCalendars(cachedAccessToken);

    const userEmail = result.user.email || null;
    const userName = result.user.displayName || 'Google User';
    const userPhoto = result.user.photoURL || null;

    // Update persistent metadata
    saveStoredMeta({
      isConnected: true,
      userEmail,
      userName,
      userPhoto,
      selectedCalendarId: state.selectedCalendarId || 'primary'
    });

    state.isConnected = true;
    state.isConnecting = false;
    state.userEmail = userEmail;
    state.userName = userName;
    state.userPhoto = userPhoto;
    state.availableCalendars = calendars;
    state.error = null;

    addSecurityLog(
      'Google Calendar Connected',
      `Authenticated Google Calendar account (${userEmail || 'unknown'}) for shift syncing.`,
      'auth'
    );

    notifyStateChanged();
    return { success: true };
  } catch (err: any) {
    console.error('Google Calendar Connection failed:', err);
    const errorDetails = parseCalendarError(err);
    
    state.isConnecting = false;
    state.error = errorDetails;
    notifyStateChanged();

    // Broadcast toast event for global UI awareness
    window.dispatchEvent(
      new CustomEvent('workspace-calendar-error', { detail: errorDetails })
    );

    // Also dispatch to the app's diagnostic toast system
    window.dispatchEvent(
      new CustomEvent('workspace-notification-toast', {
        detail: {
          type: errorDetails.code === 'POPUP_CLOSED' ? 'info' : 'error',
          title: `Google Calendar: ${errorDetails.title}`,
          message: `${errorDetails.message} ${errorDetails.actionHint}`,
          errorCode: errorDetails.code
        }
      })
    );

    return { success: false, error: errorDetails };
  }
}

/**
 * Disconnect Google Calendar and clear session safely
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  cachedAccessToken = null;
  currentFirebaseUser = null;

  saveStoredMeta({
    isConnected: false,
    userEmail: null,
    userName: null,
    userPhoto: null,
    lastSyncTime: null,
    selectedCalendarId: 'primary'
  });

  state = {
    ...state,
    isConnected: false,
    isConnecting: false,
    isSyncing: false,
    userEmail: null,
    userName: null,
    userPhoto: null,
    lastSyncTime: null,
    availableCalendars: [],
    error: null
  };

  try {
    const auth = getAuth();
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }

  addSecurityLog(
    'Google Calendar Disconnected',
    'Revoked local session and unlinked Google Calendar synchronization.',
    'auth'
  );

  notifyStateChanged();
}

/**
 * Dismiss active error without changing connection state
 */
export function clearCalendarError(): void {
  state.error = null;
  state.isConnecting = false;
  state.isSyncing = false;
  notifyStateChanged();
}

/**
 * Fetch list of Google Calendars for the user
 */
export async function fetchUserCalendars(token?: string): Promise<GoogleCalendarProfile[]> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw {
      status: 401,
      message: 'No active Google Calendar token available. Please reconnect.'
    };
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
    {
      headers: {
        Authorization: `Bearer ${activeToken}`,
        Accept: 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      message: errData?.error?.message || `Google Calendar API returned status ${response.status}`,
      details: errData
    };
  }

  const data = await response.json();
  const items: GoogleCalendarProfile[] = (data.items || []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary || 'Untitled Calendar',
    primary: !!cal.primary,
    backgroundColor: cal.backgroundColor || '#3b82f6',
    timeZone: cal.timeZone
  }));

  state.availableCalendars = items;
  notifyStateChanged();
  return items;
}

/**
 * Test Calendar Connection Health
 */
export async function testCalendarConnection(): Promise<{ success: boolean; message: string; error?: CalendarErrorDetails }> {
  if (!state.isConnected) {
    return {
      success: false,
      message: 'Google Calendar is not currently connected. Click Connect to link your account.'
    };
  }

  if (!cachedAccessToken) {
    const err: CalendarErrorDetails = {
      code: 'TOKEN_EXPIRED',
      title: 'Authentication Required',
      message: 'In-memory Google session is no longer active.',
      actionHint: 'Click Reconnect Google Calendar to authorize your session for today.',
      isRetryable: true
    };
    state.error = err;
    notifyStateChanged();
    return { success: false, message: err.message, error: err };
  }

  try {
    const calendars = await fetchUserCalendars(cachedAccessToken);
    const primaryCal = calendars.find(c => c.primary) || calendars[0];
    return {
      success: true,
      message: `Calendar connection active! Connected to "${primaryCal?.summary || 'Primary Calendar'}" (${calendars.length} writable calendar${calendars.length > 1 ? 's' : ''} available).`
    };
  } catch (err: any) {
    const errorDetails = parseCalendarError(err);
    state.error = errorDetails;
    notifyStateChanged();
    return { success: false, message: errorDetails.message, error: errorDetails };
  }
}

/**
 * Set target calendar ID (e.g. 'primary' or secondary)
 */
export function setSelectedCalendarId(calendarId: string) {
  state.selectedCalendarId = calendarId;
  saveStoredMeta({ selectedCalendarId: calendarId });
  notifyStateChanged();
}

/**
 * Sync Shifts and Time Off Requests to Google Calendar with detailed per-item error handling
 */
export interface SyncResults {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

export async function syncShiftsToGoogleCalendar(
  shifts: FutureShift[],
  timeOffs: TimeOffRequest[] = []
): Promise<{ success: boolean; results: SyncResults; error?: CalendarErrorDetails }> {
  if (!state.isConnected) {
    const err: CalendarErrorDetails = {
      code: 'ACCESS_DENIED',
      title: 'Google Calendar Not Connected',
      message: 'Please connect your Google Calendar account before syncing shifts.',
      actionHint: 'Click the "Connect Google Calendar" button above to get started.',
      isRetryable: true
    };
    state.error = err;
    notifyStateChanged();
    return { success: false, results: { total: 0, synced: 0, failed: 0, errors: [err.message] }, error: err };
  }

  if (!cachedAccessToken) {
    const err: CalendarErrorDetails = {
      code: 'TOKEN_EXPIRED',
      title: 'Session Token Expired',
      message: 'Your Google authorization token needs a quick refresh.',
      actionHint: 'Click "Reconnect Calendar" to refresh your session and start syncing.',
      isRetryable: true
    };
    state.error = err;
    notifyStateChanged();
    return { success: false, results: { total: 0, synced: 0, failed: 0, errors: [err.message] }, error: err };
  }

  state.isSyncing = true;
  state.error = null;
  notifyStateChanged();

  const results: SyncResults = {
    total: shifts.length + timeOffs.filter(t => t.status === 'approved').length,
    synced: 0,
    failed: 0,
    errors: []
  };

  const calendarId = encodeURIComponent(state.selectedCalendarId || 'primary');

  try {
    // 1. Sync future shifts
    for (const shift of shifts) {
      try {
        const startIso = `${shift.date}T${shift.startTime || '08:00'}:00`;
        const endIso = `${shift.date}T${shift.endTime || '17:00'}:00`;

        const eventPayload = {
          summary: `💼 Shift: ${shift.project || 'Scheduled Work'}`,
          description: `WORKSPACE Scheduled Shift\nProject: ${shift.project}\nAssigned to: ${shift.fullName} (@${shift.username})\n${shift.notes ? `Notes: ${shift.notes}\n` : ''}Generated by WORKSPACE Time Tracking`,
          location: shift.location || 'Jobsite',
          start: {
            dateTime: new Date(startIso).toISOString()
          },
          end: {
            dateTime: new Date(endIso).toISOString()
          },
          colorId: '9' // Blue / Blueberry
        };

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cachedAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload)
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        results.synced++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Shift on ${shift.date}: ${e.message}`);
      }
    }

    // 2. Sync approved time-off requests
    const approvedTimeOff = timeOffs.filter(t => t.status === 'approved');
    for (const to of approvedTimeOff) {
      try {
        const eventPayload = {
          summary: `🏖️ Time Off: ${to.fullName} (${to.reason || 'Approved Leave'})`,
          description: `WORKSPACE Approved Time Off\nReason: ${to.reason}\nEmployee: ${to.fullName}\nStatus: Approved`,
          start: {
            date: to.startDate // All-day event YYYY-MM-DD
          },
          end: {
            date: to.endDate // All-day event YYYY-MM-DD
          },
          colorId: '2' // Sage / Green
        };

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cachedAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload)
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        results.synced++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Time off ${to.startDate} to ${to.endDate}: ${e.message}`);
      }
    }

    // Update last sync time
    const nowIso = new Date().toISOString();
    state.lastSyncTime = nowIso;
    state.isSyncing = false;
    saveStoredMeta({ lastSyncTime: nowIso });

    addSecurityLog(
      'Calendar Sync Executed',
      `Synced ${results.synced} events to Google Calendar (${results.failed} failures).`,
      'sync'
    );

    notifyStateChanged();
    return { success: results.failed === 0, results };
  } catch (err: any) {
    console.error('Batch Calendar Sync encountered fatal error:', err);
    const errorDetails = parseCalendarError(err);
    state.isSyncing = false;
    state.error = errorDetails;
    notifyStateChanged();

    window.dispatchEvent(
      new CustomEvent('workspace-notification-toast', {
        detail: {
          type: 'error',
          title: `Google Calendar: ${errorDetails.title}`,
          message: `${errorDetails.message} ${errorDetails.actionHint}`,
          errorCode: errorDetails.code
        }
      })
    );

    return { success: false, results, error: errorDetails };
  }
}
