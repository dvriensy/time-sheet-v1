/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimesheetEntry {
  id: string;
  username?: string; // Associated user
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes: number;
  project: string; // Active Task name
  locationName: string; // Explanation of where they are
  notes: string; // Session details / notes
  hourlyRate?: number;
  lat?: number;
  lng?: number;
  geofencedClockIn?: boolean;
  geofencedClockOut?: boolean;
  totalHours: number; // calculated
  earnings?: number; // calculated
  isSynced: boolean;
  isOvertime?: boolean;
}

export interface GeofenceSettings {
  latitude: number;
  longitude: number;
  radius: number; // in meters
  name: string;
  enabled: boolean;
  autoClockIn: boolean;
  autoClockOut: boolean;
}

export interface ReminderSettings {
  clockInReminder: boolean;
  clockInTime: string; // HH:MM
  clockOutReminder: boolean;
  clockOutTime: string; // HH:MM
  geofenceReminder: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out' | 'on_break';
  currentProject?: string;
  lastActive: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string; // ISO string
  event: string;
  details: string;
  category: 'auth' | 'geofence' | 'data_privacy' | 'sync';
}

export interface SyncSettings {
  orgId: string;
  workspaceName: string;
  enabled: boolean;
  lastSyncTime: string; // ISO or empty string
  conflictPolicy: 'client_wins' | 'server_wins';
}

export interface AppSettings {
  biometricLockEnabled: boolean;
  privacyMode: boolean; // hide earnings on simple screens
  hourlyRateDefault: number;
  defaultStartTime?: string; // HH:MM, default "07:30"
  defaultEndTime?: string; // HH:MM, default "16:00"
}

export interface FutureShift {
  id: string;
  username: string;
  fullName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  project: string;
  notes?: string;
  createdAt: string;
  acknowledged?: boolean;
}

export interface SubmittedTimesheet {
  id: string;
  username: string;
  fullName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  submittedAt: string; // ISO string
  status: 'submitted' | 'approved' | 'rejected';
  entries: TimesheetEntry[];
}

export interface DispatchReply {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  message: string;
  timestamp: string; // ISO string
  isAvailableToWork: boolean; // special toggle
}

export interface WorkDispatch {
  id: string;
  managerUsername: string;
  managerName: string;
  title: string;
  shiftDetails: string;
  description: string;
  rateBonus?: string;
  createdAt: string; // ISO string
  replies: DispatchReply[];
  isClosed?: boolean;
}


