/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimesheetEntry, GeofenceSettings, TeamMember, SecurityAuditLog } from '../types';

// Let's seed timesheets for the last 4 weeks (weekly cycles)
// Week 1: June 1 - June 7
// Week 2: June 8 - June 14
// Week 3: June 15 - June 21
// Week 4: June 22 - June 25 (Active week)

export const DEFAULT_GEOFENCE: GeofenceSettings = {
  latitude: 37.7749, // San Francisco Downtown Office
  longitude: -122.4194,
  radius: 150, // 150 meters
  name: "HQ Tech Park",
  enabled: true,
  autoClockIn: true,
  autoClockOut: true
};

export const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Sarah Jenkins', status: 'clocked_in', currentProject: 'Acme Redesign', lastActive: '2026-06-25T09:12:00Z' },
  { id: '2', name: 'Michael Chen', status: 'on_break', currentProject: 'API Integration', lastActive: '2026-06-25T12:05:00Z' },
  { id: '3', name: 'Elena Rostova', status: 'clocked_out', lastActive: '2026-06-24T17:30:00Z' },
  { id: '4', name: 'Marcus Brody', status: 'clocked_in', currentProject: 'Database Migration', lastActive: '2026-06-25T08:45:00Z' }
];

export const MOCK_TIMESHEETS: TimesheetEntry[] = [
  // Week 1
  {
    id: 'ts-1',
    date: '2026-06-01',
    startTime: '09:00',
    endTime: '17:30',
    breakMinutes: 30,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Designed landing page heroes and structured grid system with Tailwind.',
    hourlyRate: 45,
    totalHours: 8.0,
    earnings: 360,
    isSynced: true,
    geofencedClockIn: true,
    geofencedClockOut: true
  },
  {
    id: 'ts-2',
    date: '2026-06-02',
    startTime: '08:45',
    endTime: '17:15',
    breakMinutes: 45,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Completed secondary visual guidelines and client review session.',
    hourlyRate: 45,
    totalHours: 7.75,
    earnings: 348.75,
    isSynced: true
  },
  {
    id: 'ts-3',
    date: '2026-06-03',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    project: 'Cloud Migration',
    locationName: 'HQ Tech Park',
    notes: 'Initial blueprint draft for multi-tenant Firestore structures.',
    hourlyRate: 50,
    totalHours: 8.0,
    earnings: 400,
    isSynced: true
  },
  {
    id: 'ts-4',
    date: '2026-06-04',
    startTime: '09:15',
    endTime: '17:45',
    breakMinutes: 30,
    project: 'Cloud Migration',
    locationName: 'Remote (Home)',
    notes: 'Refactoring existing server routes and planning security rules.',
    hourlyRate: 50,
    totalHours: 8.0,
    earnings: 400,
    isSynced: true
  },
  {
    id: 'ts-5',
    date: '2026-06-05',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    project: 'Admin & Standup',
    locationName: 'HQ Tech Park',
    notes: 'Weekly summary meeting, team retrospective, and timesheet reports submittal.',
    hourlyRate: 45,
    totalHours: 7.5,
    earnings: 337.5,
    isSynced: true
  },

  // Week 2
  {
    id: 'ts-6',
    date: '2026-06-08',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 45,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Coding visual dashboard interactive widgets and hook structures.',
    hourlyRate: 45,
    totalHours: 8.25,
    earnings: 371.25,
    isSynced: true,
    geofencedClockIn: true
  },
  {
    id: 'ts-7',
    date: '2026-06-09',
    startTime: '08:30',
    endTime: '17:00',
    breakMinutes: 30,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Debugging viewport responsiveness and optimizing bundle loading.',
    hourlyRate: 45,
    totalHours: 8.0,
    earnings: 360,
    isSynced: true
  },
  {
    id: 'ts-8',
    date: '2026-06-10',
    startTime: '09:00',
    endTime: '17:45',
    breakMinutes: 45,
    project: 'Cloud Migration',
    locationName: 'HQ Tech Park',
    notes: 'Conducting scale testing on live Firestore instance with batch writes.',
    hourlyRate: 50,
    totalHours: 8.0,
    earnings: 400,
    isSynced: true
  },
  {
    id: 'ts-9',
    date: '2026-06-11',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 30,
    project: 'Cloud Migration',
    locationName: 'Remote (Home)',
    notes: 'Securing cloud structures and creating security specs document.',
    hourlyRate: 50,
    totalHours: 8.5,
    earnings: 425,
    isSynced: true
  },
  {
    id: 'ts-10',
    date: '2026-06-12',
    startTime: '09:00',
    endTime: '16:30',
    breakMinutes: 30,
    project: 'Admin & Standup',
    locationName: 'HQ Tech Park',
    notes: 'Submitting timesheet, preparing client-facing demonstration deck.',
    hourlyRate: 45,
    totalHours: 7.0,
    earnings: 315,
    isSynced: true
  },

  // Week 3
  {
    id: 'ts-11',
    date: '2026-06-15',
    startTime: '08:45',
    endTime: '17:45',
    breakMinutes: 45,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Interactive onboarding flow wizard implementation with Framer Motion.',
    hourlyRate: 45,
    totalHours: 8.25,
    earnings: 371.25,
    isSynced: true
  },
  {
    id: 'ts-12',
    date: '2026-06-16',
    startTime: '09:00',
    endTime: '17:30',
    breakMinutes: 30,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Client feedback adjustments on onboarding layout and text nodes.',
    hourlyRate: 45,
    totalHours: 8.0,
    earnings: 360,
    isSynced: true
  },
  {
    id: 'ts-13',
    date: '2026-06-17',
    startTime: '09:00',
    endTime: '18:30',
    breakMinutes: 60,
    project: 'Internal Tools',
    locationName: 'HQ Tech Park',
    notes: 'Kickoff meeting for internal analytics engine. Prototyping schema structures.',
    hourlyRate: 45,
    totalHours: 8.5,
    earnings: 382.5,
    isSynced: true
  },
  {
    id: 'ts-14',
    date: '2026-06-18',
    startTime: '09:00',
    endTime: '17:45',
    breakMinutes: 30,
    project: 'Internal Tools',
    locationName: 'Remote (Home)',
    notes: 'Building canvas based charts and integration points with Recharts API.',
    hourlyRate: 45,
    totalHours: 8.25,
    earnings: 371.25,
    isSynced: true
  },
  {
    id: 'ts-15',
    date: '2026-06-19',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    project: 'Admin & Standup',
    locationName: 'HQ Tech Park',
    notes: 'Weekly wrapup. Compliance reviews and team sync up.',
    hourlyRate: 45,
    totalHours: 7.5,
    earnings: 337.5,
    isSynced: true
  },

  // Week 4 (Active/Incomplete Week)
  {
    id: 'ts-16',
    date: '2026-06-22',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 45,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Testing complete visual suite. Performing accessibility audits.',
    hourlyRate: 45,
    totalHours: 8.25,
    earnings: 371.25,
    isSynced: false,
    geofencedClockIn: true,
    geofencedClockOut: true
  },
  {
    id: 'ts-17',
    date: '2026-06-23',
    startTime: '08:50',
    endTime: '17:20',
    breakMinutes: 30,
    project: 'Acme Redesign',
    locationName: 'HQ Tech Park',
    notes: 'Packaging Redesign files. Initiating handoff procedures to client development group.',
    hourlyRate: 45,
    totalHours: 8.0,
    earnings: 360,
    isSynced: false
  },
  {
    id: 'ts-18',
    date: '2026-06-24',
    startTime: '09:00',
    endTime: '17:45',
    breakMinutes: 45,
    project: 'Internal Tools',
    locationName: 'HQ Tech Park',
    notes: 'Refining data-table features, sorting, searching and bulk export commands.',
    hourlyRate: 45,
    totalHours: 8.0,
    earnings: 360,
    isSynced: false,
    geofencedClockIn: true
  }
];

export const MOCK_SECURITY_LOGS: SecurityAuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-06-25T08:00:12Z',
    event: 'Local Data Enclosure Created',
    details: 'Timesheet SQLite local storage initialized. Cryptographic key hash established client side.',
    category: 'data_privacy'
  },
  {
    id: 'log-2',
    timestamp: '2026-06-25T08:50:35Z',
    event: 'Biometric Handshake Completed',
    details: 'FaceID verification successfully authenticated. Client profile unlocked locally.',
    category: 'auth'
  },
  {
    id: 'log-3',
    timestamp: '2026-06-25T09:01:05Z',
    event: 'GPS Geofence Boundary Breached',
    details: 'User coordinates matched [37.7751, -122.4192]. Ingress trigger authorized Auto Clock-In.',
    category: 'geofence'
  },
  {
    id: 'log-4',
    timestamp: '2026-06-25T11:30:00Z',
    event: 'GDPR Right to Be Forgotten Audit',
    details: 'Local sandbox scanning verified: zero external tracker packets dispatched.',
    category: 'data_privacy'
  }
];
