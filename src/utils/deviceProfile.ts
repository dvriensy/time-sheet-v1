/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { safeSetItem } from './storage';

export type PhoneModelId =
  | 'auto'
  | 'iphone_compact'
  | 'iphone_standard'
  | 'iphone_max'
  | 'android_compact'
  | 'android_ultra'
  | 'desktop';

export type TopInsetMode = 'auto' | 'none' | 'status_bar' | 'notch' | 'dynamic_island';
export type BottomInsetMode = 'auto' | 'none' | 'home_bar' | 'gesture_bar';

export interface DeviceProfileSettings {
  phoneModel: PhoneModelId;
  uiScale: number; // e.g. 0.90, 0.95, 1.0, 1.05
  topInsetMode: TopInsetMode;
  bottomInsetMode: BottomInsetMode;
  compactCards: boolean;
}

export interface PhoneModelPreset {
  id: PhoneModelId;
  name: string;
  subtitle: string;
  platform: 'ios' | 'android' | 'auto' | 'desktop';
  screenSpec: string;
  defaultScale: number;
  defaultTopInset: TopInsetMode;
  defaultBottomInset: BottomInsetMode;
  defaultCompact: boolean;
}

export const PHONE_MODEL_PRESETS: PhoneModelPreset[] = [
  {
    id: 'auto',
    name: 'Auto-Detect Device',
    subtitle: 'Automatically adapts to your phone screen & PWA mode',
    platform: 'auto',
    screenSpec: 'Dynamic Viewport',
    defaultScale: 1.0,
    defaultTopInset: 'auto',
    defaultBottomInset: 'auto',
    defaultCompact: false,
  },
  {
    id: 'iphone_compact',
    name: 'iPhone SE / 12 Mini / 13 Mini',
    subtitle: 'Compact 4.7" – 5.4" iOS Display',
    platform: 'ios',
    screenSpec: '375 × 667 / 812 px',
    defaultScale: 0.91,
    defaultTopInset: 'notch',
    defaultBottomInset: 'home_bar',
    defaultCompact: true,
  },
  {
    id: 'iphone_standard',
    name: 'iPhone 13 / 14 / 15 / 16 & Pro',
    subtitle: 'Standard 6.1" – 6.3" iOS Display (Notch / Dynamic Island)',
    platform: 'ios',
    screenSpec: '390 × 844 / 393 × 852 px',
    defaultScale: 0.95,
    defaultTopInset: 'dynamic_island',
    defaultBottomInset: 'home_bar',
    defaultCompact: true,
  },
  {
    id: 'iphone_max',
    name: 'iPhone Plus / Pro Max',
    subtitle: 'Large 6.7" – 6.9" iOS Display (Dynamic Island)',
    platform: 'ios',
    screenSpec: '430 × 932 / 440 × 956 px',
    defaultScale: 1.0,
    defaultTopInset: 'dynamic_island',
    defaultBottomInset: 'home_bar',
    defaultCompact: false,
  },
  {
    id: 'android_compact',
    name: 'Android Standard (Galaxy S / Pixel)',
    subtitle: 'Standard 6.1" – 6.3" Android Display',
    platform: 'android',
    screenSpec: '360 × 800 / 384 × 854 px',
    defaultScale: 0.93,
    defaultTopInset: 'status_bar',
    defaultBottomInset: 'gesture_bar',
    defaultCompact: true,
  },
  {
    id: 'android_ultra',
    name: 'Android Large / Ultra (Galaxy Ultra / Pixel Pro)',
    subtitle: 'Large 6.7" – 6.8" Android Display',
    platform: 'android',
    screenSpec: '412 × 915 px',
    defaultScale: 1.0,
    defaultTopInset: 'status_bar',
    defaultBottomInset: 'gesture_bar',
    defaultCompact: false,
  },
  {
    id: 'desktop',
    name: 'Tablet / Desktop Full View',
    subtitle: 'Standard multi-column widescreen layout',
    platform: 'desktop',
    screenSpec: '1024 px+',
    defaultScale: 1.0,
    defaultTopInset: 'none',
    defaultBottomInset: 'none',
    defaultCompact: false,
  },
];

const STORAGE_KEY_DEVICE_PROFILE = 'timesheets_tracker_device_profile';

export function detectHardwareEnvironment(): {
  os: 'ios' | 'android' | 'desktop';
  isStandalone: boolean;
  width: number;
  height: number;
  suggestedPreset: PhoneModelId;
} {
  if (typeof window === 'undefined') {
    return { os: 'desktop', isStandalone: false, width: 1280, height: 800, suggestedPreset: 'auto' };
  }

  const ua = window.navigator.userAgent || '';
  const isIOS = /iPhone|iPod|iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const os: 'ios' | 'android' | 'desktop' = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as any).standalone);

  const width = window.innerWidth;
  const height = window.innerHeight;

  let suggestedPreset: PhoneModelId = 'desktop';
  if (os === 'ios') {
    if (width <= 376) suggestedPreset = 'iphone_compact';
    else if (width <= 405) suggestedPreset = 'iphone_standard';
    else suggestedPreset = 'iphone_max';
  } else if (os === 'android') {
    if (width <= 395) suggestedPreset = 'android_compact';
    else suggestedPreset = 'android_ultra';
  } else if (width < 640) {
    suggestedPreset = width <= 380 ? 'iphone_compact' : 'iphone_standard';
  }

  return { os, isStandalone, width, height, suggestedPreset };
}

export function getDeviceProfile(): DeviceProfileSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEVICE_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        phoneModel: parsed.phoneModel || 'auto',
        uiScale: typeof parsed.uiScale === 'number' ? parsed.uiScale : 1.0,
        topInsetMode: parsed.topInsetMode || 'auto',
        bottomInsetMode: parsed.bottomInsetMode || 'auto',
        compactCards: typeof parsed.compactCards === 'boolean' ? parsed.compactCards : false,
      };
    }
  } catch (e) {
    console.warn('Failed to read device profile settings:', e);
  }
  return {
    phoneModel: 'auto',
    uiScale: 1.0,
    topInsetMode: 'auto',
    bottomInsetMode: 'auto',
    compactCards: false,
  };
}

export function saveDeviceProfile(settings: DeviceProfileSettings): void {
  safeSetItem(STORAGE_KEY_DEVICE_PROFILE, JSON.stringify(settings));
  applyDeviceProfileToDocument(settings);
  window.dispatchEvent(new CustomEvent('device-profile-changed', { detail: settings }));
}

export function applyDeviceProfileToDocument(settings?: DeviceProfileSettings): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const profile = settings || getDeviceProfile();
  const env = detectHardwareEnvironment();
  const root = document.documentElement;

  const isMobileScreen = env.width < 768 || profile.phoneModel !== 'desktop';

  // Determine effective preset when in 'auto'
  const effectivePreset =
    profile.phoneModel === 'auto'
      ? PHONE_MODEL_PRESETS.find((p) => p.id === env.suggestedPreset) || PHONE_MODEL_PRESETS[0]
      : PHONE_MODEL_PRESETS.find((p) => p.id === profile.phoneModel) || PHONE_MODEL_PRESETS[0];

  // Effective scale
  const effectiveScale =
    profile.phoneModel === 'auto' && profile.uiScale === 1.0 && env.width < 640
      ? effectivePreset.defaultScale
      : profile.uiScale;

  // Effective compact mode
  const effectiveCompact =
    profile.phoneModel === 'auto'
      ? env.width < 415 || effectivePreset.defaultCompact
      : profile.compactCards;

  // Calculate top safe area padding
  const topMode =
    profile.topInsetMode === 'auto'
      ? env.isStandalone
        ? effectivePreset.defaultTopInset
        : 'none'
      : profile.topInsetMode;

  let topExtraPx = 0;
  if (topMode === 'status_bar') topExtraPx = 12;
  else if (topMode === 'notch') topExtraPx = 20;
  else if (topMode === 'dynamic_island') topExtraPx = 28;

  // Calculate bottom safe area padding
  const bottomMode =
    profile.bottomInsetMode === 'auto'
      ? env.isStandalone || env.os !== 'desktop'
        ? effectivePreset.defaultBottomInset
        : 'none'
      : profile.bottomInsetMode;

  let bottomExtraPx = 0;
  if (bottomMode === 'home_bar') bottomExtraPx = 14;
  else if (bottomMode === 'gesture_bar') bottomExtraPx = 10;

  root.setAttribute('data-phone-model', profile.phoneModel);
  root.setAttribute('data-compact-ui', effectiveCompact ? 'true' : 'false');
  root.setAttribute('data-standalone-app', env.isStandalone ? 'true' : 'false');

  // Apply root font-size scaling on mobile/phone profiles so rem-based Tailwind spacing & typography fit the screen cleanly
  if (isMobileScreen && profile.phoneModel !== 'desktop') {
    const baseFontPx = Math.round(16 * effectiveScale * 10) / 10;
    root.style.fontSize = `${baseFontPx}px`;
  } else {
    root.style.fontSize = '16px';
  }

  root.style.setProperty('--device-top-extra', `${topExtraPx}px`);
  root.style.setProperty('--device-bottom-extra', `${bottomExtraPx}px`);
}
