/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimesheetEntry, GeofenceSettings, ReminderSettings, SecurityAuditLog, SyncSettings, AppSettings, FutureShift } from '../types';
import { DEFAULT_GEOFENCE, MOCK_TIMESHEETS, MOCK_SECURITY_LOGS } from '../data/mockData';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const auth = getAuth();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Storage keys
const KEY_TIMESHEETS = 'timesheets_tracker_records';
const KEY_GEOFENCE = 'timesheets_tracker_geofence';
const KEY_REMINDERS = 'timesheets_tracker_reminders';
const KEY_SECURITY_LOGS = 'timesheets_tracker_security_logs';
const KEY_SYNC = 'timesheets_tracker_sync';
const KEY_APP_SETTINGS = 'timesheets_tracker_app_settings';
const KEY_FUTURE_SHIFTS = 'timesheets_tracker_future_shifts';

// Background Firestore Sync Writers
export async function syncUserToFirestore(user: UserAccount) {
  try {
    await setDoc(doc(db, 'users', user.username), user);
  } catch (err) {
    console.error('Firestore syncUserToFirestore error:', err);
    handleFirestoreError(err, OperationType.WRITE, `users/${user.username}`);
  }
}

export async function deleteUserFromFirestore(username: string) {
  try {
    await deleteDoc(doc(db, 'users', username));
  } catch (err) {
    console.error('Firestore deleteUserFromFirestore error:', err);
    handleFirestoreError(err, OperationType.DELETE, `users/${username}`);
  }
}

export async function syncTimesheetToFirestore(entry: TimesheetEntry) {
  try {
    await setDoc(doc(db, 'timesheets', entry.id), entry);
  } catch (err) {
    console.error('Firestore syncTimesheetToFirestore error:', err);
    handleFirestoreError(err, OperationType.WRITE, `timesheets/${entry.id}`);
  }
}

export async function deleteTimesheetFromFirestore(id: string) {
  try {
    await deleteDoc(doc(db, 'timesheets', id));
  } catch (err) {
    console.error('Firestore deleteTimesheetFromFirestore error:', err);
    handleFirestoreError(err, OperationType.DELETE, `timesheets/${id}`);
  }
}

export async function syncActiveSessionToFirestore(username: string, session: ActiveSession) {
  try {
    await setDoc(doc(db, 'activeSessions', username), session);
  } catch (err) {
    console.error('Firestore syncActiveSessionToFirestore error:', err);
    handleFirestoreError(err, OperationType.WRITE, `activeSessions/${username}`);
  }
}

export async function deleteActiveSessionFromFirestore(username: string) {
  try {
    await deleteDoc(doc(db, 'activeSessions', username));
  } catch (err) {
    console.error('Firestore deleteActiveSessionFromFirestore error:', err);
    handleFirestoreError(err, OperationType.DELETE, `activeSessions/${username}`);
  }
}

export async function syncTimeOffRequestToFirestore(request: TimeOffRequest) {
  try {
    await setDoc(doc(db, 'timeOffRequests', request.id), request);
  } catch (err) {
    console.error('Firestore syncTimeOffRequestToFirestore error:', err);
    handleFirestoreError(err, OperationType.WRITE, `timeOffRequests/${request.id}`);
  }
}

export async function syncFutureShiftToFirestore(shift: FutureShift) {
  try {
    await setDoc(doc(db, 'futureShifts', shift.id), shift);
  } catch (err) {
    console.error('Firestore syncFutureShiftToFirestore error:', err);
    handleFirestoreError(err, OperationType.WRITE, `futureShifts/${shift.id}`);
  }
}

export async function deleteFutureShiftFromFirestore(id: string) {
  try {
    await deleteDoc(doc(db, 'futureShifts', id));
  } catch (err) {
    console.error('Firestore deleteFutureShiftFromFirestore error:', err);
    handleFirestoreError(err, OperationType.DELETE, `futureShifts/${id}`);
  }
}

export async function initializeFirebaseSync(onSyncCallback?: () => void) {
  try {
    // 1. Sync Users
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      // Seed Firestore with local users (if any exist)
      const localUsers = getAllUsers();
      for (const u of localUsers) {
        await setDoc(doc(db, 'users', u.username), u);
      }
    } else {
      // Overwrite local storage with firestore users
      const firestoreUsers: UserAccount[] = [];
      usersSnap.forEach(docSnap => {
        firestoreUsers.push(docSnap.data() as UserAccount);
      });
      localStorage.setItem(KEY_USERS_LIST, JSON.stringify(firestoreUsers));
    }

    // 2. Sync Timesheets
    const timesheetsSnap = await getDocs(collection(db, 'timesheets'));
    if (timesheetsSnap.empty) {
      const localTimesheets = getTimesheetsAllRaw();
      for (const t of localTimesheets) {
        await setDoc(doc(db, 'timesheets', t.id), t);
      }
    } else {
      const firestoreTimesheets: TimesheetEntry[] = [];
      timesheetsSnap.forEach(docSnap => {
        firestoreTimesheets.push(docSnap.data() as TimesheetEntry);
      });
      localStorage.setItem(KEY_TIMESHEETS, JSON.stringify(firestoreTimesheets));
    }

    // 3. Sync Active Sessions
    const sessionsSnap = await getDocs(collection(db, 'activeSessions'));
    const firestoreSessions: Record<string, ActiveSession> = {};
    sessionsSnap.forEach(docSnap => {
      firestoreSessions[docSnap.id] = docSnap.data() as ActiveSession;
    });
    localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(firestoreSessions));

    // 4. Sync Time-Off Requests
    const timeOffSnap = await getDocs(collection(db, 'timeOffRequests'));
    if (timeOffSnap.empty) {
      const localTimeOff = getTimeOffRequests();
      for (const tr of localTimeOff) {
        await setDoc(doc(db, 'timeOffRequests', tr.id), tr);
      }
    } else {
      const firestoreTimeOff: TimeOffRequest[] = [];
      timeOffSnap.forEach(docSnap => {
        firestoreTimeOff.push(docSnap.data() as TimeOffRequest);
      });
      localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(firestoreTimeOff));
    }

    // 4.5 Sync Future Shifts
    const futureShiftsSnap = await getDocs(collection(db, 'futureShifts'));
    if (futureShiftsSnap.empty) {
      const localFutureShifts = getFutureShifts();
      for (const fs of localFutureShifts) {
        await setDoc(doc(db, 'futureShifts', fs.id), fs);
      }
    } else {
      const firestoreFutureShifts: FutureShift[] = [];
      futureShiftsSnap.forEach(docSnap => {
        firestoreFutureShifts.push(docSnap.data() as FutureShift);
      });
      localStorage.setItem(KEY_FUTURE_SHIFTS, JSON.stringify(firestoreFutureShifts));
    }

    if (onSyncCallback) onSyncCallback();

    // 5. Setup Real-time Listeners
    onSnapshot(collection(db, 'users'), (snap) => {
      const updatedUsers: UserAccount[] = [];
      snap.forEach(docSnap => {
        updatedUsers.push(docSnap.data() as UserAccount);
      });
      if (updatedUsers.length > 0) {
        localStorage.setItem(KEY_USERS_LIST, JSON.stringify(updatedUsers));
        if (onSyncCallback) onSyncCallback();
        window.dispatchEvent(new Event('storage-sync'));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    onSnapshot(collection(db, 'timesheets'), (snap) => {
      const updatedTimesheets: TimesheetEntry[] = [];
      snap.forEach(docSnap => {
        updatedTimesheets.push(docSnap.data() as TimesheetEntry);
      });
      localStorage.setItem(KEY_TIMESHEETS, JSON.stringify(updatedTimesheets));
      if (onSyncCallback) onSyncCallback();
      window.dispatchEvent(new Event('storage-sync'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'timesheets');
    });

    onSnapshot(collection(db, 'activeSessions'), (snap) => {
      const updatedSessions: Record<string, ActiveSession> = {};
      snap.forEach(docSnap => {
        updatedSessions[docSnap.id] = docSnap.data() as ActiveSession;
      });
      localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(updatedSessions));
      if (onSyncCallback) onSyncCallback();
      window.dispatchEvent(new Event('storage-sync'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activeSessions');
    });

    onSnapshot(collection(db, 'timeOffRequests'), (snap) => {
      const updatedRequests: TimeOffRequest[] = [];
      snap.forEach(docSnap => {
        updatedRequests.push(docSnap.data() as TimeOffRequest);
      });
      localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(updatedRequests));
      if (onSyncCallback) onSyncCallback();
      window.dispatchEvent(new Event('storage-sync'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'timeOffRequests');
    });

    onSnapshot(collection(db, 'futureShifts'), (snap) => {
      const updatedShifts: FutureShift[] = [];
      snap.forEach(docSnap => {
        updatedShifts.push(docSnap.data() as FutureShift);
      });
      localStorage.setItem(KEY_FUTURE_SHIFTS, JSON.stringify(updatedShifts));
      if (onSyncCallback) onSyncCallback();
      window.dispatchEvent(new Event('storage-sync'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'futureShifts');
    });

  } catch (err) {
    console.error('Firebase synchronization failed to initialize:', err);
    handleFirestoreError(err, OperationType.GET, null);
  }
}

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
  password?: string;
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
  role?: 'employee' | 'manager';
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
  };

  if (updated.fullName !== undefined) {
    const trimmed = updated.fullName.trim();
    updatedUser.fullName = trimmed;
    const parts = trimmed.split(/\s+/);
    updatedUser.firstName = parts[0] || trimmed;
    updatedUser.lastName = parts.slice(1).join(' ') || '';
  } else {
    updatedUser.fullName = `${updated.firstName !== undefined ? updated.firstName : original.firstName} ${updated.lastName !== undefined ? updated.lastName : original.lastName}`.trim();
  }

  users[index] = updatedUser;
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  syncUserToFirestore(updatedUser);
  return updatedUser;
}

export function managerUpdateUserAccount(username: string, updated: Partial<UserAccount>): UserAccount | null {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return null;

  const original = users[index];
  
  const updatedUser: UserAccount = {
    ...original,
    ...updated,
  };
  
  if (updated.firstName !== undefined || updated.lastName !== undefined) {
    const fName = updated.firstName !== undefined ? updated.firstName : original.firstName;
    const lName = updated.lastName !== undefined ? updated.lastName : original.lastName;
    updatedUser.fullName = `${fName} ${lName}`.trim();
  }

  users[index] = updatedUser;
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  syncUserToFirestore(updatedUser);
  return updatedUser;
}

export function registerUser(fullName: string, username: string, password?: string, hourlyRate?: number, autoLogin: boolean = true): boolean {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const targetUsername = username.trim().toLowerCase();
  const exists = users.some(u => u.username === targetUsername);
  if (exists) return false;
  
  const trimmedName = fullName.trim();
  const nameParts = trimmedName.split(/\s+/);
  const firstName = nameParts[0] || trimmedName;
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const newUser: UserAccount = {
    username: targetUsername,
    password: password || '123456', // default if not specified
    firstName,
    lastName,
    fullName: trimmedName,
    hourlyRate: hourlyRate,
    role: (targetUsername === 'derek_vriens' || trimmedName.toLowerCase() === 'derek vriens') ? 'manager' : 'employee'
  };
  
  users.push(newUser);
  localStorage.setItem(KEY_USERS_LIST, JSON.stringify(users));
  
  if (autoLogin) {
    // Set current user
    localStorage.setItem(KEY_CURRENT_USER, targetUsername);
  }
  
  // Seed initial data
  seedInitialDataForUser(targetUsername, hourlyRate);
  
  // Sync to Firestore
  syncUserToFirestore(newUser);
  
  return true;
}

export function loginUser(usernameOrName: string, password?: string): boolean {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  
  const query = usernameOrName.trim().toLowerCase();
  const found = users.find(u => 
    u.username.toLowerCase() === query || 
    u.fullName.toLowerCase() === query
  );
  if (found) {
    // Let derek_vriens in easily, or any user if password matches, or if no password is set/supplied
    if (!found.password || !password || found.password === password) {
      localStorage.setItem(KEY_CURRENT_USER, found.username);
      return true;
    }
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
    const parts = (found.fullName || '').split(' ');
    found.firstName = parts[0] || found.username || 'Employee';
    found.lastName = parts.slice(1).join(' ') || '';
  }
  
  if (!found.fullName) {
    found.fullName = `${found.firstName} ${found.lastName}`.trim() || found.username || 'Employee';
  }
  
  if (!found.role) {
    found.role = (found.username === 'derek_vriens' || found.fullName.toLowerCase() === 'derek vriens') ? 'manager' : 'employee';
  }

  // Strict crash protection fallbacks
  if (found.hourlyRate === undefined || found.hourlyRate === null || isNaN(found.hourlyRate)) {
    found.hourlyRate = 45;
  }
  if (!found.password) {
    found.password = '123456';
  }
  if (!found.department) {
    found.department = 'Operations';
  }
  
  return found;
}

export function getAllUsers(): UserAccount[] {
  const usersRaw = localStorage.getItem(KEY_USERS_LIST);
  const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
  return users.map(found => {
    const parts = (found.fullName || '').split(' ');
    const firstName = found.firstName || parts[0] || found.username || 'Employee';
    const lastName = found.lastName || parts.slice(1).join(' ') || '';
    const fullName = found.fullName || `${firstName} ${lastName}`.trim() || found.username || 'Employee';
    const hourlyRate = (found.hourlyRate === undefined || found.hourlyRate === null || isNaN(found.hourlyRate)) ? 45 : found.hourlyRate;
    const password = found.password || '123456';
    const department = found.department || 'Operations';
    const role = found.role || ((found.username === 'derek_vriens' || fullName.toLowerCase() === 'derek vriens') ? 'manager' : 'employee');
    return {
      ...found,
      firstName,
      lastName,
      fullName,
      hourlyRate,
      password,
      department,
      role
    };
  });
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

  // Sync seeded entries to Firestore
  for (const entry of sampleEntries) {
    syncTimesheetToFirestore(entry);
  }
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
  syncTimesheetToFirestore(newEntry);
  
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
    const updatedEntry = {
      ...updated,
      username: currentUser,
      totalHours,
      earnings: 0,
      isSynced: false
    };
    entries[index] = updatedEntry;
    saveTimesheets(entries);
    syncTimesheetToFirestore(updatedEntry);
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
  deleteTimesheetFromFirestore(id);
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
  secondsElapsed?: number;
  breakSecondsElapsed?: number;
  isOvertime?: boolean;
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
  syncActiveSessionToFirestore(currentUsername, all[currentUsername]);
}

export function clearActiveSession() {
  const currentUsername = localStorage.getItem('timesheets_tracker_current_user');
  if (!currentUsername) return;
  
  const all = getActiveSessions();
  delete all[currentUsername];
  localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(all));
  deleteActiveSessionFromFirestore(currentUsername);
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
  
  // Sync delete user
  deleteUserFromFirestore(username);
  deleteActiveSessionFromFirestore(username);
  
  const sessionsRaw = localStorage.getItem('timesheets_tracker_active_sessions');
  if (sessionsRaw) {
    const sessions = JSON.parse(sessionsRaw);
    delete sessions[username];
    localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(sessions));
  }
  
  const entriesRaw = localStorage.getItem(KEY_TIMESHEETS);
  if (entriesRaw) {
    const entries: TimesheetEntry[] = JSON.parse(entriesRaw);
    const userTimesheets = entries.filter(e => e.username === username);
    for (const e of userTimesheets) {
      deleteTimesheetFromFirestore(e.id);
    }
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
  syncTimeOffRequestToFirestore(newRequest);
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
  syncTimeOffRequestToFirestore(requests[idx]);
  return true;
}

export function acknowledgeTimeOffResponse(id: string): boolean {
  const requests = getTimeOffRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return false;

  requests[idx].acknowledgedByRequester = true;
  localStorage.setItem(KEY_TIME_OFF_REQUESTS, JSON.stringify(requests));
  syncTimeOffRequestToFirestore(requests[idx]);
  return true;
}

export function getFutureShifts(): FutureShift[] {
  const raw = localStorage.getItem(KEY_FUTURE_SHIFTS);
  return raw ? JSON.parse(raw) : [];
}

export function addFutureShift(username: string, date: string, startTime: string, endTime: string, project: string, notes?: string): FutureShift | null {
  const users = getAllUsers();
  const foundUser = users.find(u => u.username === username);
  const fullName = foundUser ? foundUser.fullName : username;

  const shifts = getFutureShifts();
  const newShift: FutureShift = {
    id: 'fs_' + Math.random().toString(36).substr(2, 9),
    username,
    fullName,
    date,
    startTime,
    endTime,
    project,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  shifts.push(newShift);
  localStorage.setItem(KEY_FUTURE_SHIFTS, JSON.stringify(shifts));
  syncFutureShiftToFirestore(newShift);
  
  window.dispatchEvent(new Event('storage-sync'));
  return newShift;
}

export function deleteFutureShift(id: string): boolean {
  const shifts = getFutureShifts();
  const filtered = shifts.filter(s => s.id !== id);
  if (shifts.length === filtered.length) return false;
  
  localStorage.setItem(KEY_FUTURE_SHIFTS, JSON.stringify(filtered));
  deleteFutureShiftFromFirestore(id);
  
  window.dispatchEvent(new Event('storage-sync'));
  return true;
}



