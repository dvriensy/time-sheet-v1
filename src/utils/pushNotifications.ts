/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Push & Service Worker Notification Utility for WORKSPACE
 * Uses a 2-second Promise.race timeout on navigator.serviceWorker.ready,
 * automatically falls back to `new Notification(title, options)` if the Service Worker
 * times out or throws, detects embedded iframes (`window.self !== window.top`),
 * and emits visible on-screen diagnostic toasts with exact error details.
 */

import { safeSetItem, getReminderSettings } from './storage';

export interface PushSubscriptionState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  iosNeedsHomeScreen: boolean;
  isEmbeddedIframe: boolean;
}

export interface NotificationDispatchResult {
  ok: boolean;
  method?: 'service_worker' | 'direct_notification_fallback';
  status: 'sent' | 'denied' | 'default' | 'unsupported' | 'ios_needs_homescreen' | 'error';
  permission: NotificationPermission | 'unsupported';
  message: string;
  errorDetail?: string;
}

export interface DiagnosticToastPayload {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  errorCode?: string;
}

/**
 * Emit a visible on-screen diagnostic toast event so notification errors/fallbacks
 * are always visible without opening browser developer tools.
 */
export function emitNotificationDiagnosticToast(payload: DiagnosticToastPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<DiagnosticToastPayload>('workspace-notification-toast', {
        detail: payload
      })
    );
  }
}

/**
 * Format any caught error into an explicit diagnostic string (e.g., "SecurityError: ...", "Permission Denied", "SW Not Registered")
 */
function formatExactError(err: unknown, fallbackLabel = 'UnknownNotificationError'): string {
  if (!err) return fallbackLabel;
  if (err instanceof Error) {
    const name = err.name || 'Error';
    const msg = err.message || fallbackLabel;
    return msg.startsWith(name) ? msg : `${name}: ${msg}`;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Check if the app is running inside an embedded iframe (`window.self !== window.top`)
 */
export function isRunningInEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // Accessing window.top across origins throws SecurityError when inside an iframe
    return true;
  }
}

/**
 * Detect iOS, Safari, Standalone Home Screen mode, and Embedded Iframe state
 */
export function getIOSNotificationInfo(): {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  iosNeedsHomeScreen: boolean;
  isEmbeddedIframe: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isSafari: false,
      isStandalone: false,
      iosNeedsHomeScreen: false,
      isEmbeddedIframe: false
    };
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|FxiOS|Opios|EdgiOS|Android/i.test(ua);

  const isStandalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return {
    isIOS,
    isSafari,
    isStandalone,
    iosNeedsHomeScreen: isIOS && !isStandalone,
    isEmbeddedIframe: isRunningInEmbeddedIframe()
  };
}

/**
 * Safely check if the Notification API is supported in the current browser/webview
 */
export function isNotificationSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof window.Notification !== 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Safely read current Notification.permission without throwing ReferenceError on iOS/WebViews
 */
export function getNotificationPermission(): NotificationPermission {
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof window.Notification !== 'undefined'
    ) {
      return window.Notification.permission;
    }
  } catch {
    // Ignore security/context errors in restricted webviews
  }
  return 'default';
}

/**
 * Wait for `navigator.serviceWorker.ready` with a strict 2-second `Promise.race` timeout.
 * Throws a descriptive timeout/unavailable error if the Service Worker does not respond within 2 seconds.
 */
export async function getServiceWorkerReadyWithTimeout(
  timeoutMs = 2000
): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('SW Not Registered: navigator.serviceWorker is unavailable in this browser');
  }

  // Kick off registration non-blockingly in case it hasn't been registered yet
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // Handled by Promise.race below
  });

  let timerId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`SW Timeout: navigator.serviceWorker.ready did not respond within ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
    if (!reg) {
      throw new Error('SW Not Registered: ServiceWorkerRegistration resolved empty');
    }
    return reg;
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Check Notification.permission, request access if set to 'default',
 * and handle 'denied' or unsupported browsers cleanly while surfacing exact diagnostic messages.
 */
export async function ensureNotificationPermission(): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  granted: boolean;
  iosNeedsHomeScreen: boolean;
  isEmbeddedIframe: boolean;
  message: string;
  errorDetail?: string;
}> {
  const envInfo = getIOSNotificationInfo();

  if (!isNotificationSupported()) {
    const errMsg = envInfo.iosNeedsHomeScreen
      ? 'Unsupported Context (iOS Safari Tab): Save WORKSPACE to your Home Screen (Share → Add to Home Screen) to enable notifications.'
      : 'UnsupportedError: window.Notification API is not available in this browser.';
    emitNotificationDiagnosticToast({
      type: 'error',
      title: 'Notification API Unavailable',
      message: errMsg,
      errorCode: envInfo.iosNeedsHomeScreen ? 'IOS_HOMESCREEN_REQUIRED' : 'UNSUPPORTED_BROWSER'
    });
    return {
      supported: false,
      permission: 'unsupported',
      granted: false,
      iosNeedsHomeScreen: envInfo.iosNeedsHomeScreen,
      isEmbeddedIframe: envInfo.isEmbeddedIframe,
      message: errMsg,
      errorDetail: errMsg
    };
  }

  try {
    let currentPermission = window.Notification.permission;

    if (currentPermission === 'default') {
      const result = await new Promise<NotificationPermission>((resolve, reject) => {
        try {
          const maybePromise = window.Notification.requestPermission((perm) => {
            resolve(perm);
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });
      currentPermission = result;
    }

    if (currentPermission === 'granted') {
      return {
        supported: true,
        permission: 'granted',
        granted: true,
        iosNeedsHomeScreen: false,
        isEmbeddedIframe: envInfo.isEmbeddedIframe,
        message: 'Notification permission granted.'
      };
    }

    if (currentPermission === 'denied') {
      const deniedDetail = envInfo.isEmbeddedIframe
        ? 'Permission Denied (Embedded Iframe): Browsers block notifications inside iframes. Open the app in a separate browser tab.'
        : 'Permission Denied: Notification.permission is "denied". Enable notifications in your browser site settings.';
      emitNotificationDiagnosticToast({
        type: 'error',
        title: 'Permission Denied',
        message: deniedDetail,
        errorCode: 'Permission Denied'
      });
      return {
        supported: true,
        permission: 'denied',
        granted: false,
        iosNeedsHomeScreen: envInfo.iosNeedsHomeScreen,
        isEmbeddedIframe: envInfo.isEmbeddedIframe,
        message: deniedDetail,
        errorDetail: 'Permission Denied'
      };
    }

    const dismissedDetail = envInfo.isEmbeddedIframe
      ? 'Permission Dismissed (Embedded Iframe): Open the app in a separate browser tab to allow notifications.'
      : `Permission Not Granted: Notification.permission is "${currentPermission}".`;
    emitNotificationDiagnosticToast({
      type: 'warning',
      title: 'Permission Required',
      message: dismissedDetail,
      errorCode: `Permission: ${currentPermission}`
    });
    return {
      supported: true,
      permission: currentPermission,
      granted: false,
      iosNeedsHomeScreen: envInfo.iosNeedsHomeScreen,
      isEmbeddedIframe: envInfo.isEmbeddedIframe,
      message: dismissedDetail,
      errorDetail: `Permission: ${currentPermission}`
    };
  } catch (err) {
    const exactErr = formatExactError(err, 'SecurityError: Failed to request Notification permission');
    emitNotificationDiagnosticToast({
      type: 'error',
      title: 'Notification Permission Error',
      message: exactErr,
      errorCode: exactErr
    });
    return {
      supported: false,
      permission: getNotificationPermission(),
      granted: false,
      iosNeedsHomeScreen: envInfo.iosNeedsHomeScreen,
      isEmbeddedIframe: envInfo.isEmbeddedIframe,
      message: exactErr,
      errorDetail: exactErr
    };
  }
}

/**
 * Direct `new Notification(title, options)` fallback helper.
 * Strips ServiceWorker-only fields (like `actions`) if necessary and wires up click navigation.
 */
function showDirectNotificationFallback(
  title: string,
  options?: NotificationOptions & Record<string, unknown>
): Notification {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('ReferenceError: Notification API is not defined on window');
  }

  const cleanOptions: NotificationOptions = {
    body: typeof options?.body === 'string' ? options.body : undefined,
    icon: typeof options?.icon === 'string' ? options.icon : '/icon-192.png',
    badge: typeof options?.badge === 'string' ? options.badge : '/icon-192.png',
    tag: typeof options?.tag === 'string' ? options.tag : undefined,
    data: options?.data,
    requireInteraction: typeof options?.requireInteraction === 'boolean' ? options.requireInteraction : false,
    silent: typeof options?.silent === 'boolean' ? options.silent : undefined
  };

  let notif: Notification;
  try {
    notif = new window.Notification(title, cleanOptions);
  } catch {
    // Ultra-minimal fallback if browser rejects specific NotificationOptions properties
    notif = new window.Notification(title, {
      body: cleanOptions.body,
      icon: cleanOptions.icon
    });
  }

  notif.onclick = () => {
    try {
      window.focus();
      const targetUrl = (options?.data as { url?: string } | undefined)?.url;
      if (targetUrl && targetUrl.includes('log-shift')) {
        window.dispatchEvent(new CustomEvent('workspace-open-shift-logger'));
      }
      notif.close();
    } catch {
      // Ignore focus errors
    }
  };

  return notif;
}

// Convert base64 VAPID public key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register the Service Worker in public/sw.js with a 2-second timeout on ready
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    const registration = await getServiceWorkerReadyWithTimeout(2000);
    return registration;
  } catch (error) {
    console.warn('[PushNotifications] Service Worker registration/ready warning:', error);
    return null;
  }
}

/**
 * Dispatch a local notification with:
 * 1. 2-second Promise.race timeout on `navigator.serviceWorker.ready`
 * 2. Automatic fallback to `new Notification(title, options)` if SW times out or `reg.showNotification()` throws
 * 3. Visible on-screen diagnostic toast for any error or fallback event
 */
export async function dispatchServiceWorkerNotification(
  title: string,
  options?: NotificationOptions & {
    vibrate?: number[];
    actions?: Array<{ action: string; title: string }>;
    renotify?: boolean;
  }
): Promise<NotificationDispatchResult> {
  const permCheck = await ensureNotificationPermission();
  if (!permCheck.supported) {
    return {
      ok: false,
      status: permCheck.iosNeedsHomeScreen ? 'ios_needs_homescreen' : 'unsupported',
      permission: permCheck.permission,
      message: permCheck.message,
      errorDetail: permCheck.errorDetail
    };
  }

  if (!permCheck.granted) {
    return {
      ok: false,
      status: permCheck.permission === 'denied' ? 'denied' : 'default',
      permission: permCheck.permission,
      message: permCheck.message,
      errorDetail: permCheck.errorDetail
    };
  }

  const notificationOptions: NotificationOptions & Record<string, unknown> = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/?tab=timesheet&action=log-shift',
      dateOfArrival: Date.now()
    },
    ...options
  };

  // Step 1: Attempt Service Worker dispatch with a 2-second Promise.race timeout
  let swErrorDetail = '';
  try {
    const reg = await getServiceWorkerReadyWithTimeout(2000);
    if (typeof reg.showNotification !== 'function') {
      throw new Error('SW Not Registered: reg.showNotification is not available');
    }
    await reg.showNotification(title, notificationOptions);

    emitNotificationDiagnosticToast({
      type: 'success',
      title: 'Notification Sent (Service Worker)',
      message: `"${title}" dispatched via Service Worker.`
    });

    return {
      ok: true,
      method: 'service_worker',
      status: 'sent',
      permission: 'granted',
      message: 'Notification dispatched via Service Worker.'
    };
  } catch (swErr) {
    swErrorDetail = formatExactError(swErr, 'SW Not Registered');
    console.warn('[PushNotifications] Service Worker dispatch failed/timed out, attempting direct Notification() fallback:', swErrorDetail);
  }

  // Step 2: Immediate Fallback to standard `new Notification(title, options)`
  try {
    showDirectNotificationFallback(title, notificationOptions);

    const fallbackMsg = `Sent via Direct Notification API fallback (${swErrorDetail}).`;
    emitNotificationDiagnosticToast({
      type: 'warning',
      title: 'Notification Sent via Direct Fallback',
      message: fallbackMsg,
      errorCode: swErrorDetail
    });

    return {
      ok: true,
      method: 'direct_notification_fallback',
      status: 'sent',
      permission: 'granted',
      message: fallbackMsg,
      errorDetail: swErrorDetail
    };
  } catch (directErr) {
    const directErrorDetail = formatExactError(directErr, 'SecurityError');
    const combinedError = `SW Failure (${swErrorDetail}) | Direct API Failure (${directErrorDetail})`;

    emitNotificationDiagnosticToast({
      type: 'error',
      title: 'Notification Dispatch Failed',
      message: combinedError,
      errorCode: directErrorDetail
    });

    return {
      ok: false,
      status: 'error',
      permission: getNotificationPermission(),
      message: combinedError,
      errorDetail: combinedError
    };
  }
}

/**
 * Query current push notification state cleanly with a 2-second SW timeout
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  const envInfo = getIOSNotificationInfo();

  if (!isNotificationSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      registration: null,
      subscription: null,
      ...envInfo
    };
  }

  try {
    const registration = await getServiceWorkerReadyWithTimeout(2000);
    let subscription: PushSubscription | null = null;
    if ('pushManager' in registration && registration.pushManager) {
      try {
        subscription = await registration.pushManager.getSubscription();
      } catch {
        subscription = null;
      }
    }

    const currentPerm = getNotificationPermission();
    return {
      supported: true,
      permission: currentPerm,
      isSubscribed: !!subscription || currentPerm === 'granted',
      registration,
      subscription,
      ...envInfo
    };
  } catch {
    const currentPerm = getNotificationPermission();
    return {
      supported: true,
      permission: currentPerm,
      isSubscribed: currentPerm === 'granted',
      registration: null,
      subscription: null,
      ...envInfo
    };
  }
}

/**
 * Request notification permission and subscribe to notifications with automatic fallback
 */
export async function subscribeToPushNotifications(username?: string): Promise<boolean> {
  const permResult = await ensureNotificationPermission();
  if (!permResult.supported || !permResult.granted) {
    return false;
  }

  try {
    const registration = await getServiceWorkerReadyWithTimeout(2000);
    if (registration && 'pushManager' in registration && registration.pushManager) {
      let applicationServerKey: Uint8Array | undefined;
      try {
        const resp = await fetch('/api/push/vapid-public-key');
        if (resp.ok) {
          const data = await resp.json();
          if (data.publicKey) {
            applicationServerKey = urlBase64ToUint8Array(data.publicKey);
          }
        }
      } catch {
        // Optional VAPID endpoint
      }

      if (applicationServerKey) {
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        }
        if (subscription) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              username: username || 'current_user'
            })
          }).catch(() => {});
        }
      }
    }
  } catch (pushErr) {
    console.warn('[PushNotifications] Optional PushManager setup skipped, continuing with notification fallback:', pushErr);
  }

  const dispatchRes = await dispatchServiceWorkerNotification('WORKSPACE Notifications Enabled', {
    body: 'Notifications are active on this device. You will receive workday shift reminders.',
    tag: 'workspace-setup-success',
    data: { url: '/?tab=timesheet&action=log-shift' }
  });

  return dispatchRes.ok || getNotificationPermission() === 'granted';
}

/**
 * Unsubscribe from push notifications cleanly
 */
export async function unsubscribeFromPushNotifications(username?: string): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const registration = await getServiceWorkerReadyWithTimeout(2000);
    if ('pushManager' in registration && registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            username: username || 'current_user'
          })
        }).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    const exactErr = formatExactError(err, 'SW Unsubscribe Error');
    emitNotificationDiagnosticToast({
      type: 'warning',
      title: 'Unsubscribe Warning',
      message: exactErr,
      errorCode: exactErr
    });
    return false;
  }
}

/**
 * Send an immediate Test Notification (2s SW timeout -> automatic `new Notification()` fallback)
 */
export async function sendTestNotification(username?: string): Promise<NotificationDispatchResult> {
  return dispatchServiceWorkerNotification('WORKSPACE • Test Notification', {
    body: `Push & local notifications are working for ${username ? `@${username}` : 'your account'}! Tap to open your timesheet ledger.`,
    tag: `workspace-test-notification-${Date.now()}`,
    renotify: true,
    data: {
      url: '/?tab=timesheet&action=log-shift',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open_logger', title: 'Open Shift Logger' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
}

/**
 * Trigger the 5:00 PM Workday Shift Reminder Push Notification
 */
export async function trigger5pmShiftReminder(username?: string): Promise<NotificationDispatchResult> {
  try {
    await fetch('/api/push/trigger-5pm-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
  } catch {
    // Handled by local Service Worker / Direct Notification fallback below
  }

  return dispatchServiceWorkerNotification('WORKSPACE • 5:00 PM Shift Reminder', {
    body: 'Your workday shift has ended! Tap here to open the shift logger and record your hours.',
    tag: 'workday-shift-reminder-5pm',
    renotify: true,
    requireInteraction: true,
    data: {
      url: '/?tab=timesheet&action=log-shift',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open_logger', title: 'Open Shift Logger' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
}

/**
 * Client-Side Workday & Shift Alarm Scheduler
 */
let schedulerIntervalId: number | null = null;
const KEY_LAST_TRIGGERED_5PM = 'workspace_push_5pm_last_date';
const KEY_LAST_TRIGGERED_CLOCKIN = 'workspace_push_clockin_last_date';
const KEY_LAST_TRIGGERED_CLOCKOUT = 'workspace_push_clockout_last_date';

export function startWorkday5pmScheduler(
  isEnabled: () => boolean,
  username?: string,
  onTrigger?: () => void
) {
  if (schedulerIntervalId !== null) {
    clearInterval(schedulerIntervalId);
  }

  const checkSchedule = () => {
    if (!isNotificationSupported() || getNotificationPermission() !== 'granted') return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const todayStr = now.toISOString().slice(0, 10);
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (isEnabled() && isWorkday && now.getHours() === 17 && now.getMinutes() === 0) {
      const lastTriggered = localStorage.getItem(KEY_LAST_TRIGGERED_5PM);
      if (lastTriggered !== todayStr) {
        safeSetItem(KEY_LAST_TRIGGERED_5PM, todayStr);
        trigger5pmShiftReminder(username);
        if (onTrigger) onTrigger();
      }
    }

    try {
      const reminders = getReminderSettings();
      if (reminders.clockInReminder && reminders.clockInTime === currentHHMM) {
        const lastClockIn = localStorage.getItem(KEY_LAST_TRIGGERED_CLOCKIN);
        if (lastClockIn !== `${todayStr}_${currentHHMM}`) {
          safeSetItem(KEY_LAST_TRIGGERED_CLOCKIN, `${todayStr}_${currentHHMM}`);
          dispatchServiceWorkerNotification('WORKSPACE • Clock-In Reminder', {
            body: `Scheduled shift start (${reminders.clockInTime}). Tap to clock in and start your workday timer.`,
            tag: 'workspace-clockin-reminder',
            data: { url: '/?tab=timesheet' }
          });
        }
      }

      if (reminders.clockOutReminder && reminders.clockOutTime === currentHHMM) {
        const lastClockOut = localStorage.getItem(KEY_LAST_TRIGGERED_CLOCKOUT);
        if (lastClockOut !== `${todayStr}_${currentHHMM}`) {
          safeSetItem(KEY_LAST_TRIGGERED_CLOCKOUT, `${todayStr}_${currentHHMM}`);
          dispatchServiceWorkerNotification('WORKSPACE • Clock-Out Reminder', {
            body: `Scheduled shift end (${reminders.clockOutTime}). Don't forget to clock out and save your shift!`,
            tag: 'workspace-clockout-reminder',
            data: { url: '/?tab=timesheet&action=log-shift' }
          });
        }
      }
    } catch {
      // Ignore storage parsing errors
    }
  };

  checkSchedule();
  schedulerIntervalId = window.setInterval(checkSchedule, 25000);

  return () => {
    if (schedulerIntervalId !== null) {
      clearInterval(schedulerIntervalId);
      schedulerIntervalId = null;
    }
  };
}
