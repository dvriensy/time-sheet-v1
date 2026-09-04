/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Push Notification Utility for WORKSPACE
 * Uses Service Worker (public/sw.js) and Browser Push API to handle background alerts
 */

export interface PushSubscriptionState {
  supported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
}

// Convert base64 VAPID public key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[PushNotifications] Service Worker is not supported in this browser environment.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    // Wait for the active service worker
    await navigator.serviceWorker.ready;
    console.log('[PushNotifications] Service Worker successfully registered with scope:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[PushNotifications] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Query current push notification state
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return {
      supported: false,
      permission: 'default',
      isSubscribed: false,
      registration: null,
      subscription: null
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription: PushSubscription | null = null;
    if ('pushManager' in registration) {
      subscription = await registration.pushManager.getSubscription();
    }

    return {
      supported: true,
      permission: Notification.permission,
      isSubscribed: !!subscription,
      registration,
      subscription
    };
  } catch (err) {
    console.warn('[PushNotifications] Error reading push subscription state:', err);
    return {
      supported: true,
      permission: Notification.permission,
      isSubscribed: false,
      registration: null,
      subscription: null
    };
  }
}

/**
 * Request notification permission and subscribe to browser Push API
 */
export async function subscribeToPushNotifications(username?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[PushNotifications] Notification permission denied or dismissed:', permission);
    return false;
  }

  // 2. Ensure Service Worker is registered
  const registration = await registerServiceWorker();
  if (!registration || !('pushManager' in registration)) {
    throw new Error('Service Worker or Push Manager not available.');
  }

  try {
    // 3. Retrieve VAPID public key from backend
    let applicationServerKey: Uint8Array | undefined;
    try {
      const resp = await fetch('/api/push/vapid-public-key');
      if (resp.ok) {
        const data = await resp.json();
        if (data.publicKey) {
          applicationServerKey = urlBase64ToUint8Array(data.publicKey);
        }
      }
    } catch (err) {
      console.warn('[PushNotifications] Could not fetch server VAPID key, subscribing with default options:', err);
    }

    // 4. Subscribe via PushManager
    const subscribeOptions: PushSubscriptionOptionsInit = {
      userVisibleOnly: true,
      ...(applicationServerKey ? { applicationServerKey } : {})
    };

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // 5. Send subscription to backend
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
      } catch (backendErr) {
        console.warn('[PushNotifications] Subscription created locally, but could not sync to backend:', backendErr);
      }
    }

    // 6. Show initial confirmation notification via Service Worker
    await registration.showNotification('WORKSPACE Notifications Enabled', {
      body: 'Daily workday reminders active. You will receive a shift alert at 5:00 PM.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'workspace-setup-success',
      data: { url: '/?tab=timesheet&action=log-shift' }
    });

    return true;
  } catch (error) {
    console.error('[PushNotifications] Failed to subscribe to Push API:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(username?: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('pushManager' in registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Notify backend
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
              username: username || 'current_user'
            })
          });
        } catch (e) {
          console.warn('[PushNotifications] Could not inform server of unsubscription:', e);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[PushNotifications] Error unsubscribing:', err);
    return false;
  }
}

/**
 * Trigger the 5:00 PM Workday Shift Reminder Push Notification
 * Shows directly through the Service Worker and sends to server push if available
 */
export async function trigger5pmShiftReminder(username?: string): Promise<boolean> {
  try {
    // 1. Send via server API if possible
    let serverSuccess = false;
    try {
      const resp = await fetch('/api/push/trigger-5pm-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (resp.ok) {
        serverSuccess = true;
      }
    } catch (e) {
      console.warn('[PushNotifications] Server push trigger skipped or offline, using local Service Worker:', e);
    }

    // 2. Also trigger via active Service Worker registration
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('WORKSPACE • 5:00 PM Shift Reminder', {
        body: "Your workday shift has ended! Tap here to open the shift logger and record your hours.",
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'workday-shift-reminder-5pm',
        data: {
          url: '/?tab=timesheet&action=log-shift',
          dateOfArrival: Date.now()
        },
        actions: [
          { action: 'open_logger', title: 'Open Shift Logger' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        requireInteraction: true
      } as any);
      return true;
    }

    return serverSuccess;
  } catch (err) {
    console.error('[PushNotifications] Failed to trigger 5:00 PM shift reminder:', err);
    return false;
  }
}

/**
 * Client-Side Workday 5:00 PM Scheduler
 * Checks every 30 seconds if current time is 17:00 on Monday-Friday and triggers reminder if enabled.
 */
let schedulerIntervalId: number | null = null;
const KEY_LAST_TRIGGERED_DATE = 'workspace_push_5pm_last_date';

export function startWorkday5pmScheduler(
  isEnabled: () => boolean,
  username?: string,
  onTrigger?: () => void
) {
  if (schedulerIntervalId !== null) {
    clearInterval(schedulerIntervalId);
  }

  const checkSchedule = () => {
    if (!isEnabled()) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday

    if (!isWorkday) return;

    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Trigger at 5:00 PM (17:00)
    if (hours === 17 && minutes === 0) {
      const todayStr = now.toISOString().slice(0, 10);
      const lastTriggered = localStorage.getItem(KEY_LAST_TRIGGERED_DATE);

      if (lastTriggered !== todayStr) {
        localStorage.setItem(KEY_LAST_TRIGGERED_DATE, todayStr);
        console.log('[PushNotifications] 5:00 PM workday milestone reached, firing push notification!');
        trigger5pmShiftReminder(username);
        if (onTrigger) onTrigger();
      }
    }
  };

  // Run initial check and set interval every 25 seconds
  checkSchedule();
  schedulerIntervalId = window.setInterval(checkSchedule, 25000);

  return () => {
    if (schedulerIntervalId !== null) {
      clearInterval(schedulerIntervalId);
      schedulerIntervalId = null;
    }
  };
}
