/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimesheetEntry, GeofenceSettings, ReminderSettings, SecurityAuditLog, SyncSettings, AppSettings } from '../types';
import { DEFAULT_GEOFENCE, MOCK_TIMESHEETS, MOCK_SECURITY_LOGS } from '../data/mockData';

// Storage keys
const KEY_TIMESHEETS = 'timesheets_tracker_records';
const KEY_GEOFENCE = 'timesheets_tracker_geofence';
const KEY_REMINDERS = 'timesheets_tracker_reminders';
const KEY_SECURITY_LOGS = 'timesheets_tracker_security_logs';
const KEY_SYNC = 'timesheets_tracker_sync';
const KEY_APP_SETTINGS = 'timesheets_tracker_app_settings';

// Initialize data if not already present
export function initializeStorage() {
  if (!localStorage.getItem(KEY_TIMESHEETS)) {
    localStorage.setItem(KEY_TIMESHEETS, JSON.stringify(MOCK_TIMESHEETS));
  }
  if (!localStorage.getItem(KEY_GEOFENCE)) {
    localStorage.setItem(KEY_GEOFENCE, JSON.stringify(DEFAULT_GEOFENCE));
  }
  if (!localStorage.getItem(KEY_REMINDERS)) {
    const defaultReminders: ReminderSettings = {
      clockInReminder: true,
      clockInTime: '09:00',
      clockOutReminder: true,
      clockOutTime: '17:00',
      geofenceReminder: true
    };
    localStorage.setItem(KEY_REMINDERS, JSON.stringify(defaultReminders));
  }
  if (!localStorage.getItem(KEY_SECURITY_LOGS)) {
    localStorage.setItem(KEY_SECURITY_LOGS, JSON.stringify(MOCK_SECURITY_LOGS));
  }
  if (!localStorage.getItem(KEY_SYNC)) {
    const defaultSync: SyncSettings = {
      orgId: '',
      workspaceName: '',
      enabled: false,
      lastSyncTime: '',
      conflictPolicy: 'client_wins'
    };
    localStorage.setItem(KEY_SYNC, JSON.stringify(defaultSync));
  }
  if (!localStorage.getItem(KEY_APP_SETTINGS)) {
    const defaultAppSettings: AppSettings = {
      biometricLockEnabled: true,
      privacyMode: false,
      hourlyRateDefault: 45
    };
    localStorage.setItem(KEY_APP_SETTINGS, JSON.stringify(defaultAppSettings));
  }
}

// Users list key
const KEY_USERS_LIST = 'timesheets_tracker_users_list';
const KEY_CURRENT_USER = 'timesheets_tracker_current_user';

export interface UserAccount {
  username: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  hourlyRate?: number;
  avatarUrl?: string; // Holds Base64 string or image URL
  bio?: string;
  email?: string;
  phone?: string;
  department?: string;
}

export function updateUserAccount(updated: Partial<UserAccount>): UserAccount | null {
  const currentUsername = localStorage.getItem(KEY_CURRENT_USER);
  if (!currentUsername) return null;

  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const index = users.findIndex(u => u.username === currentUsername);
  if (index === -1) return null;

  const original = users[index];
  
  const updatedUser: UserAccount = {
    ...original,
    ...updated,
    fullName: `${updated.firstName !== undefined ? updated.firstName : original.firstName} ${updated.lastName !== undefined ? updated.lastName : original.lastName}`.trim(),
  };

  users[index] = updatedUser;
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  return updatedUser;
}

export function registerUser(firstName: string, lastName: string, hourlyRate?: number): boolean {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const username = `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;
  const exists = users.some(u => u.username === username);
  if (exists) return false;
  
  const newUser: UserAccount = {
    username,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName: `${firstName.trim()} ${lastName.trim()}`,
    hourlyRate: hourlyRate
  };
  
  users.push(newUser);
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  
  // Set current user
  localStorage.setItem(KEY_CURRENT_USER, username);
  
  // Seed initial data
  seedInitialDataForUser(username, hourlyRate);
  
  return true;
}

export function loginUser(firstName: string, lastName: string): boolean {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const username = `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;
  const found = users.find(u => u.username === username);
  if (found) {
    localStorage.setItem(KEY_CURRENT_USER, found.username);
    return true;
  }
  return false;
}

export function getCurrentUser(): UserAccount | null {
  const username = localStorage.getItem(KEY_CURRENT_USER);
  if (!username) return null;
  
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  const found = users.find(u => u.username === username);
  if (!found) return null;
  
  // Dynamic fallback for firstName & lastName if missing from legacy account
  if (!found.firstName || !found.lastName) {
    const parts = found.fullName.split(' ');
    found.firstName = parts[0] || found.username;
    found.lastName = parts.slice(1).join(' ') || '';
  }
  
  return found;
}

export function getAllUsers(): UserAccount[] {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  return usersRaw ? JSON.parse(usersRaw) : [];
}

export function logoutUser() {
  localStorage.removeItem(KEY_CURRENT_USER);
}

function seedInitialDataForUser(username: string, hourlyRate?: number) {
  const raw = localStorage.getItem(KEY_TIMESHEETS);
  const all: TimesheetEntry[] = raw ? JSON.parse(raw) : [];
  
  const now = new Date();
  const year = now.getFullYear();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  
  const sampleEntries: TimesheetEntry[] = [
    {
      id: `ts-seed-1-${Math.random().toString(36).substr(2, 4)}`,
      username,
      date: `${year}-${monthStr}-02`,
      startTime: '08:30',
      endTime: '17:00',
      breakMinutes: 30,
      project: 'Main Site Framer Layout',
      locationName: 'HQ Office',
      notes: 'Constructed responsive grid layouts and integrated initial components.',
      totalHours: 8.0,
      isSynced: false
    },
    {
      id: `ts-seed-2-${Math.random().toString(36).substr(2, 4)}`,
      username,
      date: `${year}-${monthStr}-10`,
      startTime: '09:00',
      endTime: '17:30',
      breakMinutes: 45,
      project: 'Core Express Routing',
      locationName: 'HQ Site B',
      notes: 'Designed controller schemas and checked security logs.',
      totalHours: 7.75,
      isSynced: false
    }
  ];
  
  const combined = [...sampleEntries, ...all];
  localStorage.setItem(KEY_TIMESHEETS, JSON.stringify(combined));
}

// Timesheets
export function getTimesheetsAllRaw(): TimesheetEntry[] {
  initializeStorage();
  const raw = localStorage.getItem(KEY_TIMESHEETS);
  return raw ? JSON.parse(raw) : [];
}

export function getTimesheets(): TimesheetEntry[] {
  const all = getTimesheetsAllRaw();
  const currentUser = localStorage.getItem(KEY_CURRENT_USER);
  if (!currentUser) return [];
  return all.filter(e => e.username === currentUser);
}

export function saveTimesheets(entries: TimesheetEntry[]) {
  const currentUser = localStorage.getItem(KEY_CURRENT_USER);
  if (!currentUser) return;
  
  const all = getTimesheetsAllRaw();
  const others = all.filter(e => e.username !== currentUser);
  const marked = entries.map(e => ({ ...e, username: currentUser }));
  
  localStorage.setItem(KEY_TIMESHEETS, JSON.stringify([...marked, ...others]));
}

export function calculateHoursAndEarnings(startTime: string, endTime: string, breakMinutes: number, rate?: number) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startVal = startH * 60 + startM;
  let endVal = endH * 60 + endM;
  
  // Handle cross-midnight clocking
  if (endVal < startVal) {
    endVal += 24 * 60;
  }
  
  const totalMinutes = Math.max(0, endVal - startVal - breakMinutes);
  const totalHours = Number((totalMinutes / 60).toFixed(2));
  
  return { totalHours, earnings: 0 };
}

export function addTimesheetEntry(entry: Omit<TimesheetEntry, 'id' | 'totalHours' | 'earnings' | 'isSynced'>): TimesheetEntry {
  const entries = getTimesheets();
  const currentUser = localStorage.getItem(KEY_CURRENT_USER) || 'guest';
  const { totalHours, earnings } = calculateHoursAndEarnings(entry.startTime, entry.endTime, entry.breakMinutes, entry.hourlyRate || 0);
  
  const newEntry: TimesheetEntry = {
    ...entry,
    username: currentUser,
    id: `ts-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    totalHours,
    earnings: 0,
    isSynced: false
  };
  
  entries.unshift(newEntry); // newest first
  saveTimesheets(entries);
  
  addSecurityLog(
    'Manual timesheet edit',
    `Created timesheet card for task: ${entry.project} on ${entry.date} (Hours: ${totalHours})`,
    'data_privacy'
  );
  
  return newEntry;
}

export function updateTimesheetEntry(updated: TimesheetEntry) {
  const entries = getTimesheets();
  const index = entries.findIndex(e => e.id === updated.id);
  const currentUser = localStorage.getItem(KEY_CURRENT_USER) || 'guest';
  if (index !== -1) {
    const { totalHours, earnings } = calculateHoursAndEarnings(updated.startTime, updated.endTime, updated.breakMinutes, updated.hourlyRate || 0);
    entries[index] = {
      ...updated,
      username: currentUser,
      totalHours,
      earnings: 0,
      isSynced: false
    };
    saveTimesheets(entries);
    addSecurityLog(
      'Manual timesheet edit',
      `Modified timesheet card [${updated.id}] on date ${updated.date}`,
      'data_privacy'
    );
  }
}

export function deleteTimesheetEntry(id: string) {
  const entries = getTimesheets();
  const filtered = entries.filter(e => e.id !== id);
  saveTimesheets(filtered);
  addSecurityLog(
    'Manual timesheet edit',
    `Deleted timesheet card [${id}]`,
    'data_privacy'
  );
}

// Geofence Settings
export function getGeofenceSettings(): GeofenceSettings {
  initializeStorage();
  const raw = localStorage.getItem(KEY_GEOFENCE);
  return raw ? JSON.parse(raw) : DEFAULT_GEOFENCE;
}

export function saveGeofenceSettings(settings: GeofenceSettings) {
  localStorage.setItem(KEY_GEOFENCE, JSON.stringify(settings));
  addSecurityLog(
    'GPS tracking geofence breached',
    `Geofence parameter re-configured. Center: [${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}], Radius: ${settings.radius}m.`,
    'geofence'
  );
}

// Reminder Settings
export function getReminderSettings(): ReminderSettings {
  initializeStorage();
  const raw = localStorage.getItem(KEY_REMINDERS);
  return raw ? JSON.parse(raw) : {
    clockInReminder: true,
    clockInTime: '09:00',
    clockOutReminder: true,
    clockOutTime: '17:00',
    geofenceReminder: true
  };
}

export function saveReminderSettings(settings: ReminderSettings) {
  localStorage.setItem(KEY_REMINDERS, JSON.stringify(settings));
  addSecurityLog(
    'GDPR Right to Be Forgotten Audit',
    `Automatic reminder notifications re-configured. Clock-In: ${settings.clockInReminder ? 'Active' : 'Disabled'}, Clock-Out: ${settings.clockOutReminder ? 'Active' : 'Disabled'}.`,
    'data_privacy'
  );
}

// Sync Settings
export function getSyncSettings(): SyncSettings {
  initializeStorage();
  const raw = localStorage.getItem(KEY_SYNC);
  return raw ? JSON.parse(raw) : {
    orgId: '',
    workspaceName: '',
    enabled: false,
    lastSyncTime: '',
    conflictPolicy: 'client_wins'
  };
}

export function saveSyncSettings(settings: SyncSettings) {
  localStorage.setItem(KEY_SYNC, JSON.stringify(settings));
  addSecurityLog(
    'Sync status changed',
    `Workspace sync preferences modified. Workspace: "${settings.workspaceName || 'None'}", Synchronization: ${settings.enabled ? 'ONLINE' : 'OFFLINE'}.`,
    'sync'
  );
}

// App Settings
export function getAppSettings(): AppSettings {
  initializeStorage();
  const raw = localStorage.getItem(KEY_APP_SETTINGS);
  return raw ? JSON.parse(raw) : {
    biometricLockEnabled: true,
    privacyMode: false,
    hourlyRateDefault: 45
  };
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem(KEY_APP_SETTINGS, JSON.stringify(settings));
  addSecurityLog(
    'Biometric lock preferences adjusted',
    `App settings changed. Biometric lock enabled: ${settings.biometricLockEnabled}, Privacy masking: ${settings.privacyMode}`,
    'auth'
  );
}

// Security Audit Logs
export function getSecurityLogs(): SecurityAuditLog[] {
  initializeStorage();
  const raw = localStorage.getItem(KEY_SECURITY_LOGS);
  return raw ? JSON.parse(raw) : [];
}

export function addSecurityLog(event: string, details: string, category: SecurityAuditLog['category']) {
  const logs = getSecurityLogs();
  const newLog: SecurityAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    event,
    details,
    category
  };
  logs.unshift(newLog);
  // Keep logs at max 100 entries
  if (logs.length > 100) {
    logs.pop();
  }
  localStorage.setItem(KEY_SECURITY_LOGS, JSON.stringify(logs));
}

export function clearSecurityLogs() {
  localStorage.setItem(KEY_SECURITY_LOGS, JSON.stringify([]));
}

// Exporters for Industry Privacy Compliance
export function exportTimesheetsAsCSV(): string {
  const entries = getTimesheets();
  if (entries.length === 0) return '';

  const headers = ['Date', 'Project', 'Start Time', 'End Time', 'Break (Mins)', 'Total Hours', 'Hourly Rate', 'Earnings ($)', 'Location', 'Notes', 'Geofenced'];
  const rows = entries.map(e => [
    e.date,
    `"${e.project.replace(/"/g, '""')}"`,
    e.startTime,
    e.endTime,
    e.breakMinutes,
    e.totalHours,
    e.hourlyRate,
    e.earnings,
    `"${e.locationName.replace(/"/g, '""')}"`,
    `"${e.notes.replace(/"/g, '""')}"`,
    (e.geofencedClockIn || e.geofencedClockOut) ? 'YES' : 'NO'
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportAllDataAsJSON(): string {
  const data = {
    app: 'Timesheet Tracker & Geofencer',
    exportedAt: new Date().toISOString(),
    timesheets: getTimesheets(),
    geofence: getGeofenceSettings(),
    reminders: getReminderSettings(),
    settings: getAppSettings(),
    sync: getSyncSettings(),
    securityAuditTrail: getSecurityLogs()
  };
  return JSON.stringify(data, null, 2);
}

export function wipeAllLocalData() {
  localStorage.removeItem(KEY_TIMESHEETS);
  localStorage.removeItem(KEY_GEOFENCE);
  localStorage.removeItem(KEY_REMINDERS);
  localStorage.removeItem(KEY_SECURITY_LOGS);
  localStorage.removeItem(KEY_SYNC);
  localStorage.removeItem(KEY_APP_SETTINGS);
  
  // Reinitialize clean
  initializeStorage();
  
  addSecurityLog(
    'GDPR Right to Be Forgotten Audit',
    'User triggered structural data scrub. All timesheet records, geofences, and logs wiped securely.',
    'data_privacy'
  );
}

// Helpers for pay periods twice a month (1-15 and 16-end of month)
export interface PayPeriodGroup {
  periodStr: string;
  start: string;
  end: string;
  entries: TimesheetEntry[];
}

export function getPayPeriodsGrouped(): PayPeriodGroup[] {
  const entries = getTimesheets();
  const groups: { [key: string]: TimesheetEntry[] } = {};
  
  entries.forEach(entry => {
    const dateObj = new Date(entry.date + 'T00:00:00');
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth(); // 0-11
    const day = dateObj.getDate();
    
    let startStr = '';
    let endStr = '';
    
    if (day <= 15) {
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    } else {
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    const key = `${startStr} to ${endStr}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  });
  
  return Object.keys(groups).map(key => {
    const [start, end] = key.split(' to ');
    const periodEntries = [...groups[key]].sort((a, b) => a.date.localeCompare(b.date));
    return {
      periodStr: key,
      start,
      end,
      entries: periodEntries
    };
  }).sort((a, b) => b.start.localeCompare(a.start)); // newest pay periods first
}

export interface ActiveSession {
  username: string;
  fullName: string;
  isClockedIn: boolean;
  isOnBreak: boolean;
  startTime: string;
  project: string;
  location: string;
  notes: string;
  lastActiveTimestamp: string;
}

export function getActiveSessions(): Record<string, ActiveSession> {
  const raw = localStorage.getItem('timesheets_tracker_active_sessions');
  return raw ? JSON.parse(raw) : {};
}

export function updateActiveSession(session: Partial<ActiveSession>) {
  const currentUsername = localStorage.getItem('timesheets_tracker_current_user');
  if (!currentUsername) return;
  
  const currentUserObj = getCurrentUser();
  const fullName = currentUserObj ? currentUserObj.fullName : currentUsername;
  
  const all = getActiveSessions();
  const existing = all[currentUsername] || {
    username: currentUsername,
    fullName,
    isClockedIn: false,
    isOnBreak: false,
    startTime: '',
    project: '',
    location: '',
    notes: '',
    lastActiveTimestamp: new Date().toISOString()
  };
  
  all[currentUsername] = {
    ...existing,
    ...session,
    lastActiveTimestamp: new Date().toISOString()
  };
  
  localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(all));
}

export function clearActiveSession() {
  const currentUsername = localStorage.getItem('timesheets_tracker_current_user');
  if (!currentUsername) return;
  
  const all = getActiveSessions();
  delete all[currentUsername];
  localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(all));
}

export function deleteUserAccount(username: string): boolean {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  let users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const exists = users.some(u => u.username === username);
  if (!exists) return false;
  
  const currentUsername = localStorage.getItem(KEY_CURRENT_USER);
  if (currentUsername === username) {
    return false;
  }
  
  users = users.filter(u => u.username !== username);
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  
  const sessionsRaw = localStorage.getItem('timesheets_tracker_active_sessions');
  if (sessionsRaw) {
    const sessions = JSON.parse(sessionsRaw);
    delete sessions[username];
    localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(sessions));
  }
  
  const entriesRaw = localStorage.getItem(KEY_TIMESHEETS);
  if (entriesRaw) {
    const entries: TimesheetEntry[] = JSON.parse(entriesRaw);
    const filteredEntries = entries.filter(e => e.username !== username);
    localStorage.setItem(KEY_TIMESHEETS, JSON.stringify(filteredEntries));
  }
  
  return true;
}

export interface TimeOffRequest {
  id: string;
  username: string;
  fullName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  acknowledgedByRequester: boolean;
  managerNotes?: string;
  respondedAt?: string;
}

const KEY_TIME_OFF_REQUESTS = 'timesheets_tracker_time_off_requests';

export function getTimeOffRequests(): TimeOffRequest[] {
  const raw = localStorage.getItem(KEY_TIME_OFF_REQUESTS);
  return raw ? JSON.parse(raw) : [];
}

export function addTimeOffRequest(startDate: string, endDate: string, reason: string): TimeOffRequest | null {
  const currentUserObj = getCurrentUser();
  if (!currentUserObj) return null;

  const requests = getTimeOffRequests();
  const newRequest: TimeOffRequest = {
    id: 'tr_' + Math.random().toString(36).substr(2, 9),
    username: currentUserObj.username,
    fullName: currentUserObj.fullName,
    startDate,
    endDate,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
    acknowledgedByRequester: false
  };

  requests.push(newRequest);
  localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(requests));
  return newRequest;
}

export function respondToTimeOffRequest(id: string, status: 'approved' | 'denied', managerNotes?: string): boolean {
  const requests = getTimeOffRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return false;

  requests[idx].status = status;
  requests[idx].managerNotes = managerNotes;
  requests[idx].respondedAt = new Date().toISOString();
  requests[idx].acknowledgedByRequester = false; // reset so requester gets notified

  localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(requests));
  return true;
}

export function acknowledgeTimeOffResponse(id: string): boolean {
  const requests = getTimeOffRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return false;

  requests[idx].acknowledgedByRequester = true;
  localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(requests));
  return true;
}



