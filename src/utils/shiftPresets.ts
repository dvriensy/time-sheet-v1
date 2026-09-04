export interface ShiftPreset {
  id: string;
  name: string;
  label: string;
  description: string;
  badge: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  bypassLunch: boolean;
  isOvertime: boolean;
  project: string;
  location: string;
  notes: string;
}

/**
 * Rounds an "HH:mm" time string to the nearest interval (5 or 15 minutes).
 */
export function roundTimeString(timeStr: string, intervalMinutes: 5 | 15 = 15): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return timeStr;

  const totalMinutes = h * 60 + m;
  const rounded = Math.round(totalMinutes / intervalMinutes) * intervalMinutes;

  // Clamp within 24-hour day (0 to 1439 mins)
  const clamped = Math.max(0, Math.min(23 * 60 + 59, rounded));
  const newH = Math.floor(clamped / 60);
  const newM = clamped % 60;

  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Gets the current time rounded to the nearest interval (5 or 15 minutes).
 */
export function getCurrentRoundedTime(intervalMinutes: 5 | 15 = 15, date: Date = new Date()): string {
  const currentStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return roundTimeString(currentStr, intervalMinutes);
}

/**
 * Calculates an end time given a start time and duration in minutes, keeping in 24h format.
 */
export function calculateEndTimeFromDuration(startTimeStr: string, durationMinutes: number): string {
  if (!startTimeStr || !startTimeStr.includes(':')) return '16:00';
  const [h, m] = startTimeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '16:00';

  const total = (h * 60 + m + durationMinutes) % (24 * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Common Shift Presets for 1-tap logging
 */
export const SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: 'standard_8h',
    name: 'Standard 8h Day',
    label: 'Standard 8h Day',
    description: '7:30 AM – 4:00 PM (8.5 gross hrs - 30m lunch = 8.0 hrs)',
    badge: '8.0h Reg',
    startTime: '07:30',
    endTime: '16:00',
    breakMinutes: 30,
    bypassLunch: false,
    isOvertime: false,
    project: 'General Work',
    location: 'Office / Site',
    notes: 'Standard 8-hour shift',
  },
  {
    id: 'half_day',
    name: 'Half Day',
    label: 'Half Day',
    description: '7:30 AM – 11:30 AM (4.0 hrs, no lunch deduction)',
    badge: '4.0h Reg',
    startTime: '07:30',
    endTime: '11:30',
    breakMinutes: 0,
    bypassLunch: true,
    isOvertime: false,
    project: 'General Work',
    location: 'Site',
    notes: 'Half-day shift (4.0 hrs)',
  },
  {
    id: 'on_call',
    name: 'On-Call',
    label: 'On-Call',
    description: 'On-call emergency / dispatch duty (Overtime)',
    badge: 'On-Call OT',
    startTime: '16:00',
    endTime: '20:00',
    breakMinutes: 0,
    bypassLunch: true,
    isOvertime: true,
    project: 'On-Call Duty',
    location: 'Remote / Field',
    notes: 'On-call shift response',
  },
];
