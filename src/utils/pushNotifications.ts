/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Push & Service Worker Notification Utility for WORKSPACE
 * Uses Service Worker (public/sw.js) and navigator.serviceWorker.ready.then(reg => reg.showNotification(...))
 * to handle local and push alerts reliably across mobile (iOS Home Screen PWA / Android) and desktop.
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
}

export interface NotificationDispatchResult {
  ok: boolean;
  status: 'sent' | 'denied' | 'default' | 'unsupported' | 'ios_needs_homescreen' | 'error';
  permission: NotificationPermission | 'unsupported';
  message: string;
}

/**
 * Detect iOS, Safari, and Standalone Home Screen mode
 */
export function getIOSNotificationInfo(): {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  iosNeedsHomeScreen: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isSafari: false,
      isStandalone: false,
      iosNeedsHomeScreen: false
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
    iosNeedsHomeScreen: isIOS && !isStandalone
  };
}

/**
 * Safely check if Service Worker & Notification APIs are supported in the current browser/webview
 */
export function isNotificationSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
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
 * Check Notification.permission, request access if set to 'default',
 * and handle 'denied' or unsupported browsers cleanly without throwing errors.
 */
export async function ensureNotificationPermission(): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  granted: boolean;
  iosNeedsHomeScreen: boolean;
  message: string;
}> {
  const iosInfo = getIOSNotificationInfo();

  if (!isNotificationSupported()) {
    if (iosInfo.iosNeedsHomeScreen) {
      return {
        supported: false,
        permission: 'unsupported',
        granted: false,
        iosNeedsHomeScreen: true,
        message:
          'On iOS Safari, notifications require saving WORKSPACE to your Home Screen first (Share → Add to Home Screen).'
      };
    }
    return {
      supported: false,
      permission: 'unsupported',
      granted: false,
      iosNeedsHomeScreen: false,
      message: 'Notifications are not supported in this browser environment.'
    };
  }

  try {
    let currentPermission = window.Notification.permission;

    if (currentPermission === 'default') {
      // Handle both Promise-based and legacy callback-based requestPermission cleanly
      const result = await new Promise<NotificationPermission>((resolve) => {
        try {
          const maybePromise = window.Notification.requestPermission((perm) => {
            resolve(perm);
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve).catch(() => resolve(getNotificationPermission()));
          }
        } catch {
          resolve(getNotificationPermission());
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
        message: 'Notification permission granted.'
      };
    }

    if (currentPermission === 'denied') {
      return {
        supported: true,
        permission: 'denied',
        granted: false,
        iosNeedsHomeScreen: false,
        message:
          'Notifications are blocked in your browser settings. Enable Notifications for this site in your browser or device settings to receive alerts.'
      };
    }

    return {
      supported: true,
      permission: currentPermission,
      granted: false,
      iosNeedsHomeScreen: iosInfo.iosNeedsHomeScreen,
      message: 'Notification permission request was dismissed.'
    };
  } catch (err) {
    console.warn('[PushNotifications] Cleanly caught permission check error:', err);
    return {
      supported: false,
      permission: 'unsupported',
      granted: false,
      iosNeedsHomeScreen: iosInfo.iosNeedsHomeScreen,
      message: 'Could not request notification permission in this browser context.'
    };
  }
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
 * Register the Service Worker in public/sw.js
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn('[PushNotifications] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Dispatch a local notification strictly through the Service Worker:
 * navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options))
 * Never calls `new Notification()` directly so mobile browsers do not block or throw.
 */
export async function dispatchServiceWorkerNotification(
  title: string,
  options?: NotificationOptions & { vibrate?: number[]; actions?: Array<{ action: string; title: string }>; renotify?: boolean }
): Promise<NotificationDispatchResult> {
  const permCheck = await ensureNotificationPermission();
  if (!permCheck.supported) {
    return {
      ok: false,
      status: permCheck.iosNeedsHomeScreen ? 'ios_needs_homescreen' : 'unsupported',
      permission: permCheck.permission,
      message: permCheck.message
    };
  }

  if (!permCheck.granted) {
    return {
      ok: false,
      status: permCheck.permission === 'denied' ? 'denied' : 'default',
      permission: permCheck.permission,
      message: permCheck.message
    };
  }

  try {
    // Ensure service worker registration is active before waiting on ready
    await registerServiceWorker();

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

    await navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification(title, notificationOptions)
    );

    return {
      ok: true,
      status: 'sent',
      permission: 'granted',
      message: 'Notification dispatched via Service Worker.'
    };
  } catch (err) {
    console.warn('[PushNotifications] Service Worker showNotification failed cleanly:', err);
    return {
      ok: false,
      status: 'error',
      permission: getNotificationPermission(),
      message: 'Service Worker could not display the notification. Try reloading the page.'
    };
  }
}

/**
 * Query current push notification state cleanly without throwing
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  const iosInfo = getIOSNotificationInfo();

  if (!isNotificationSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      registration: null,
      subscription: null,
      ...iosInfo
    };
  }

  try {
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;
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
      ...iosInfo
    };
  } catch (err) {
    console.warn('[PushNotifications] Error reading push subscription state:', err);
    return {
      supported: true,
      permission: getNotificationPermission(),
      isSubscribed: false,
      registration: null,
      subscription: null,
      ...iosInfo
    };
  }
}

/**
 * Request notification permission and subscribe to Service Worker notifications cleanly without throwing
 */
export async function subscribeToPushNotifications(username?: string): Promise<boolean> {
  const permResult = await ensureNotificationPermission();
  if (!permResult.supported || !permResult.granted) {
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    return false;
  }

  // Optional Web Push subscription if PushManager is supported by the browser
  if ('pushManager' in registration && registration.pushManager) {
    try {
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
        // Optional backend VAPID endpoint
      }

      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
        ...(applicationServerKey ? { applicationServerKey } : {})
      };

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription && applicationServerKey) {
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      }

      if (subscription) {
        try {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              username: username || 'current_user'
            })
          });
        } catch {
          // Local Service Worker notifications still work offline/without backend push
        }
      }
    } catch (pushErr) {
      console.warn('[PushNotifications] Optional PushManager subscription skipped, using Service Worker notifications:', pushErr);
    }
  }

  // Dispatch initial confirmation notification strictly through Service Worker
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
    const registration = await navigator.serviceWorker.ready;
    if ('pushManager' in registration && registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
              username: username || 'current_user'
            })
          });
        } catch {
          // Ignore backend network error
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[PushNotifications] Error unsubscribing:', err);
    return false;
  }
}

/**
 * Send an immediate Test Notification through the Service Worker
 */
export async function sendTestNotification(username?: string): Promise<NotificationDispatchResult> {
  const result = await dispatchServiceWorkerNotification('WORKSPACE • Test Notification', {
    body: `Push & Service Worker notifications are working for ${username ? `@${username}` : 'your account'}! Tap to open your timesheet ledger.`,
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

  return result;
}

/**
 * Trigger the 5:00 PM Workday Shift Reminder Push Notification
 * Dispatches through navigator.serviceWorker.ready.then(reg => reg.showNotification(...))
 */
export async function trigger5pmShiftReminder(username?: string): Promise<NotificationDispatchResult> {
  // Optional server push trigger
  try {
    await fetch('/api/push/trigger-5pm-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
  } catch {
    // Local Service Worker handles notification delivery
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
 * Dispatches 5:00 PM reminder, Clock-In alarm, and Clock-Out alarm via Service Worker
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
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const todayStr = now.toISOString().slice(0, 10);
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. 5:00 PM Workday Reminder
    if (isEnabled() && isWorkday && now.getHours() === 17 && now.getMinutes() === 0) {
      const lastTriggered = localStorage.getItem(KEY_LAST_TRIGGERED_5PM);
      if (lastTriggered !== todayStr) {
        safeSetItem(KEY_LAST_TRIGGERED_5PM, todayStr);
        trigger5pmShiftReminder(username);
        if (onTrigger) onTrigger();
      }
    }

    // 2. Custom Clock-In & Clock-Out Alarms from ReminderSettings
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
