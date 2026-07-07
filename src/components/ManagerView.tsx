/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Radio, Clock, MapPin, Briefcase, DollarSign, Search, 
  Activity, Coffee, ChevronDown, ChevronRight, CheckCircle2, 
  PlusCircle, ShieldAlert, Landmark, HelpCircle, ArrowRight, User, Trash2,
  CalendarDays, Check, X, AlertTriangle, Bell, Lock, Edit
} from 'lucide-react';
import { 
  getAllUsers, 
  getTimesheetsAllRaw, 
  getActiveSessions, 
  ActiveSession,
  registerUser,
  updateActiveSession,
  UserAccount,
  deleteUserAccount,
  managerUpdateUserAccount,
  getTimeOffRequests,
  respondToTimeOffRequest,
  TimeOffRequest,
  getFutureShifts,
  addFutureShift,
  deleteFutureShift
} from '../utils/storage';
import { TimesheetEntry, FutureShift } from '../types';
import TimeOffCalendar from './TimeOffCalendar';

interface ManagerViewProps {
  currentUser: UserAccount;
  isMobileView?: boolean;
  onLoginAsUser?: (user: UserAccount) => void;
}

export default function ManagerView({ currentUser, isMobileView = false, onLoginAsUser }: ManagerViewProps) {
  // Tabs: 'live', 'history', 'timeoff', 'schedule', or 'accounts'
  const [managerTab, setManagerTab] = useState<'live' | 'history' | 'timeoff' | 'schedule' | 'accounts'>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'break' | 'offline'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Time off decision state
  const [timeOffList, setTimeOffList] = useState<TimeOffRequest[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [timeOffViewMode, setTimeOffViewMode] = useState<'calendar' | 'list'>('calendar');


  // Expanded cards for user details
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);

  // State for Editing a User
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState<number>(45);
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<'employee' | 'manager'>('employee');

  // Dynamic poll for live sessions
  const [liveSessions, setLiveSessions] = useState<Record<string, ActiveSession>>({});

  // Scheduler state variables
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [futureShiftsList, setFutureShiftsList] = useState<FutureShift[]>([]);
  const [assignUsername, setAssignUsername] = useState('');
  const [assignProject, setAssignProject] = useState('');
  const [assignStartTime, setAssignStartTime] = useState('09:00');
  const [assignEndTime, setAssignEndTime] = useState('17:00');
  const [assignNotes, setAssignNotes] = useState('');

  const refreshFutureShifts = () => {
    setFutureShiftsList(getFutureShifts());
  };

  const [allEntries, setAllEntries] = useState<TimesheetEntry[]>([]);
  const refreshTimesheets = () => {
    setAllEntries(getTimesheetsAllRaw());
  };
  
  // Real-time user accounts and system notifications
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; timestamp: string }[]>([]);
  const knownUsernamesRef = React.useRef<Set<string>>(new Set());

  const refreshLiveSessions = () => {
    setLiveSessions(getActiveSessions());
  };

  const refreshTimeOffRequests = () => {
    setTimeOffList(getTimeOffRequests());
  };

  const refreshUsersList = () => {
    const currentUsers = getAllUsers();
    
    // Check for newly registered user accounts
    if (knownUsernamesRef.current.size > 0) {
      currentUsers.forEach(user => {
        if (!knownUsernamesRef.current.has(user.username)) {
          // Add system notification for the manager
          const newNotif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            message: `${user.fullName} (@${user.username}) registered a new account. Added to database!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setNotifications(prev => [newNotif, ...prev]);
          knownUsernamesRef.current.add(user.username);
        }
      });
    } else {
      // First load: populate seen set
      currentUsers.forEach(user => {
        knownUsernamesRef.current.add(user.username);
      });
    }
    
    setAllUsers(currentUsers);
  };

  useEffect(() => {
    refreshUsersList();
    refreshLiveSessions();
    refreshTimeOffRequests();
    refreshFutureShifts();
    refreshTimesheets();
    
    const handleSync = () => {
      refreshUsersList();
      refreshLiveSessions();
      refreshTimeOffRequests();
      refreshFutureShifts();
      refreshTimesheets();
    };
    window.addEventListener('storage-sync', handleSync);
    
    const interval = setInterval(() => {
      refreshUsersList();
      refreshLiveSessions();
      refreshTimeOffRequests();
      refreshFutureShifts();
      refreshTimesheets();
    }, 5000); // refresh live status, timeoff requests, and new users every 5 seconds
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage-sync', handleSync);
    };
  }, [refreshTrigger]);

  const handleTimeOffDecision = (id: string, status: 'approved' | 'denied', fullName: string) => {
    const note = decisionNotes[id] || '';
    const success = respondToTimeOffRequest(id, status, note);
    if (success) {
      const statusText = status === 'approved' ? 'Approved' : 'Denied';
      setSuccessMessage(`Time-off request for ${fullName} was ${statusText}. They will be notified.`);
      setDecisionNotes(prev => ({ ...prev, [id]: '' }));
      refreshTimeOffRequests();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Month controls for shift scheduler
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentMonthName = currentDate.toLocaleString('default', { month: 'long' });

  // Compute days for calendar
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0-6 (Sun-Sat)
    
    const days: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    
    // Previous month padding days
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const mNum = currentMonth === 0 ? 12 : currentMonth;
      const yNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: false });
    }
    
    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: true });
    }
    
    // Next month padding days to round up grid to multiple of 7
    const remaining = 42 - days.length;
    for (let dNum = 1; dNum <= remaining; dNum++) {
      const mNum = currentMonth === 11 ? 1 : currentMonth + 2;
      const yNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: false });
    }
    
    return days;
  }, [currentYear, currentMonth]);

  const handleAssignShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUsername || !assignProject) return;
    
    const newShift = addFutureShift(
      assignUsername,
      selectedDate,
      assignStartTime,
      assignEndTime,
      assignProject,
      assignNotes
    );
    
    if (newShift) {
      setSuccessMessage(`Assigned future shift to ${newShift.fullName} on ${selectedDate}`);
      setAssignUsername('');
      setAssignProject('');
      setAssignNotes('');
      refreshFutureShifts();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleDeleteShift = (id: string) => {
    const success = deleteFutureShift(id);
    if (success) {
      setSuccessMessage(`Successfully deleted scheduled shift.`);
      refreshFutureShifts();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleDeleteUser = async (username: string, fullName?: string) => {
    const resolvedName = fullName || allUsers.find(u => u.username === username)?.fullName || username;
    
    try {
      // 1. Call the backend API route for account deletion
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete account on backend');
      }

      // 2. Clear locally in state and localStorage
      await deleteUserAccount(username);

      setSuccessMessage(`Successfully deleted account "${resolvedName}" and cleared all logs.`);
      setConfirmDeleteUsername(null);
      
      // Keep seen set synchronized
      knownUsernamesRef.current.delete(username);
      
      // 3. Crucial: If deleting own account, clear and hard redirect
      if (username === currentUser.username) {
        console.log('Self-deletion detected. Clearing session and redirecting...');
        localStorage.clear();
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
        window.location.href = '/';
        return;
      }

      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error during account deletion:', err);
      setSuccessMessage(`Error: Unable to delete account "${resolvedName}". ${err.message || ''}`);
      setConfirmDeleteUsername(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Retrieve raw data
  // allEntries is now managed as reactive live-updating state to eliminate stats lag

  const toggleUserExpanded = (username: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  // Compute stats per user (only employee accounts)
  const userStats = useMemo(() => {
    // 1. Get all registered accounts (allowing managers to manage, edit, and delete any user)
    const employees = allUsers;
    
    // 2. Identify active sessions whose usernames are not currently in the employees list
    const employeeUsernames = new Set(employees.map(u => u.username));
    const extraEmployees: UserAccount[] = [];
    
    const sessionsList = Object.values(liveSessions) as ActiveSession[];
    sessionsList.forEach((session) => {
      if (
        session.username !== 'derek_vriens' &&
        session.username !== currentUser.username &&
        !employeeUsernames.has(session.username)
      ) {
        extraEmployees.push({
          username: session.username,
          firstName: session.fullName.split(' ')[0] || session.username,
          lastName: session.fullName.split(' ').slice(1).join(' ') || '',
          fullName: session.fullName,
          role: 'employee',
          password: '123456',
          department: 'Simulated'
        });
        employeeUsernames.add(session.username);
      }
    });

    const fullEmployeeList = [...employees, ...extraEmployees];

    return fullEmployeeList.map(user => {
      const entries = allEntries.filter(e => e.username === user.username);
      const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
      const hourlyRate = user.hourlyRate || 45;
      const totalEarnings = totalHours * hourlyRate;
      
      const activeSession = liveSessions[user.username];
      const isLive = activeSession ? activeSession.isClockedIn : false;

      return {
        ...user,
        entries,
        totalHours,
        totalEarnings,
        isLive,
        activeSession
      };
    });
  }, [allUsers, allEntries, liveSessions, currentUser.username]);

  // Filtered stats based on search and live status
  const filteredStats = useMemo(() => {
    let list = userStats;

    // Apply status filter
    if (statusFilter === 'active') {
      list = list.filter(u => u.isLive && !u.activeSession?.isOnBreak);
    } else if (statusFilter === 'break') {
      list = list.filter(u => u.isLive && u.activeSession?.isOnBreak);
    } else if (statusFilter === 'offline') {
      list = list.filter(u => !u.isLive);
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;
    return list.filter(u => {
      const matchesName = u.fullName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query);
      const matchesDepartment = u.department ? u.department.toLowerCase().includes(query) : false;
      const matchesActiveProject = u.activeSession?.project ? u.activeSession.project.toLowerCase().includes(query) : false;
      const matchesActiveLocation = u.activeSession?.location ? u.activeSession.location.toLowerCase().includes(query) : false;
      return matchesName || matchesDepartment || matchesActiveProject || matchesActiveLocation;
    });
  }, [userStats, searchQuery, statusFilter]);

  const filteredTimeOffRequests = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return timeOffList;
    return timeOffList.filter(r => {
      return (
        r.fullName.toLowerCase().includes(query) ||
        r.username.toLowerCase().includes(query) ||
        r.reason.toLowerCase().includes(query) ||
        r.status.toLowerCase().includes(query)
      );
    });
  }, [timeOffList, searchQuery]);

  // Global aggregate stats
  const aggregateStats = useMemo(() => {
    const sessionsList = Object.values(liveSessions) as ActiveSession[];
    const activeCount = sessionsList.filter(s => s.isClockedIn && !s.isOnBreak).length;
    const breakCount = sessionsList.filter(s => s.isClockedIn && s.isOnBreak).length;
    const totalTeamHours = allEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const totalPayrollEst = userStats.reduce((sum, u) => sum + u.totalEarnings, 0);

    return {
      activeCount,
      breakCount,
      totalTeamHours,
      totalPayrollEst
    };
  }, [liveSessions, allEntries, userStats]);

  // Generate a mock employee for demo purposes
  const handleAddMockEmployee = () => {
    const firstNames = ['Alice', 'Bob', 'Clara', 'David', 'Eva', 'Frank', 'Grace', 'Henry'];
    const lastNames = ['Smith', 'Jones', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas'];
    const departments = ['Engineering', 'Design', 'Product Management', 'Quality Assurance', 'Marketing'];
    const projects = ['Cloud Migration', 'Mobile SDK Design', 'Biometric Authentication', 'Vite Bundle Optimizer', 'GDPR Audit Logs'];
    const locations = ['Remote', 'HQ Office', 'HQ Site B', 'WeWork Lounge', 'Client HQ'];
    const notesList = [
      'Refactoring type imports and fixing linters.',
      'Analyzing layout metrics and color pairing.',
      'Syncing local DB packets with the Cloud.',
      'Reviewing security authentication rules.',
      'Testing geofence radius on mock coordinates.'
    ];

    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const rate = Math.floor(Math.random() * 40) + 40; // 40-80 rate

    const username = `${fName.toLowerCase()}_${lName.toLowerCase()}`;
    
    // Register without hijacking current logged-in manager session
    const success = registerUser(`${fName} ${lName}`, username, '123456', rate, false);
    if (success) {
      // Set extra fields on user account
      const usersRaw = localStorage.getItem('timesheets_tracker_users_list');
      const users: UserAccount[] = usersRaw ? JSON.parse(usersRaw) : [];
      const idx = users.findIndex(u => u.username === username);
      if (idx !== -1) {
        users[idx].department = dept;
        users[idx].bio = 'Simulated contractor account for workspace auditing.';
        users[idx].email = `${username}@ledger-demo.com`;
        users[idx].phone = `+1 (555) 01${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000) + 1000}`;
        localStorage.setItem('timesheets_tracker_users_list', JSON.stringify(users));
      }

      // Automatically clock them in for full real-time feel
      const sessions = getActiveSessions();
      sessions[username] = {
        username,
        fullName: `${fName} ${lName}`,
        isClockedIn: true,
        isOnBreak: Math.random() > 0.7,
        startTime: new Date(Date.now() - (Math.random() * 4 * 3600 * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        project: projects[Math.floor(Math.random() * projects.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        notes: notesList[Math.floor(Math.random() * notesList.length)],
        lastActiveTimestamp: new Date().toISOString()
      };
      localStorage.setItem('timesheets_tracker_active_sessions', JSON.stringify(sessions));

      setSuccessMessage(`Successfully simulated contractor "${fName} ${lName}" and clocked them in.`);
      refreshLiveSessions();
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setSuccessMessage(`Simulation conflict: "${fName} ${lName}" already exists. Trying again...`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleAddMockTimeOff = () => {
    const mockReasons = [
      "Attending family wedding out of state.",
      "Moving to a new apartment. Need 2 days for packing and logistics.",
      "Scheduled dental surgery and wisdom teeth recovery.",
      "Summer family trip to Yosemite National Park.",
      "Taking a personal mental health break and digital detox.",
      "Medical checkup and laboratory appointments."
    ];
    const users = getAllUsers();
    if (users.length === 0) {
      setSuccessMessage("Error: Register some employees first to request time off.");
      setTimeout(() => setSuccessMessage(null), 4000);
      return;
    }
    const randUser = users[Math.floor(Math.random() * users.length)];
    const randReason = mockReasons[Math.floor(Math.random() * mockReasons.length)];
    
    // Calculate dates
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() + Math.floor(Math.random() * 10) + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + Math.floor(Math.random() * 4) + 1);

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Add request
    const requests = getTimeOffRequests();
    const newRequest: TimeOffRequest = {
      id: 'tr_' + Math.random().toString(36).substr(2, 9),
      username: randUser.username,
      fullName: randUser.fullName,
      startDate: startDateStr,
      endDate: endDateStr,
      reason: randReason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      acknowledgedByRequester: false
    };

    requests.push(newRequest);
    localStorage.setItem('timesheets_tracker_time_off_requests', JSON.stringify(requests));
    refreshTimeOffRequests();
    setSuccessMessage(`Simulated new pending time-off request for ${randUser.fullName}.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleStartEditing = (user: UserAccount) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditPassword(user.password || '123456');
    setEditHourlyRate(user.hourlyRate || 45);
    setEditDepartment(user.department || 'General');
    setEditRole(user.role || 'employee');
  };

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const updated = managerUpdateUserAccount(editingUser.username, {
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      password: editPassword.trim(),
      hourlyRate: Number(editHourlyRate),
      department: editDepartment.trim(),
      role: editRole
    });
    
    if (updated) {
      setSuccessMessage(`Successfully updated profile for ${updated.fullName}.`);
      setEditingUser(null);
      refreshUsersList();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };


  return (
    <div className="w-full space-y-6 max-w-6xl mx-auto animate-fade-in" id="manager-dashboard-view">
      
      {/* Real-time New Account Live Alerts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {notifications.map(notif => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3 pointer-events-auto text-left"
            >
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Bell className="h-4 w-4 animate-bounce" />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                  Staff Ledger Sync
                </span>
                <p className="text-xs font-semibold text-slate-100 leading-snug">
                  {notif.message}
                </p>
                <span className="text-[8px] font-mono text-slate-400 block">
                  Received at {notif.timestamp}
                </span>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0 animate-fade-in"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Simulation Banner Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3 text-blue-400 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-500" />
            <p className="text-sm font-semibold">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP AGGREGATE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active workers */}
        <div className="bg-card-bg border border-main-border rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider block">Active Shifts</span>
            <span className="text-2xl font-extrabold text-main-text font-mono flex items-center gap-2">
              {aggregateStats.activeCount}
              {aggregateStats.activeCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              )}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Radio className="h-5 w-5" />
          </div>
        </div>

        {/* On Break */}
        <div className="bg-card-bg border border-main-border rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider block">Staff on Break</span>
            <span className="text-2xl font-extrabold text-main-text font-mono">{aggregateStats.breakCount}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Coffee className="h-5 w-5" />
          </div>
        </div>

        {/* Total logged hours */}
        <div className="bg-card-bg border border-main-border rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider block">Total Team Hours</span>
            <span className="text-2xl font-extrabold text-main-text font-mono">{aggregateStats.totalTeamHours.toFixed(1)} hrs</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Estimated payroll */}
        <div className="bg-card-bg border border-main-border rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider block">Payroll Estimate</span>
            <span className="text-2xl font-extrabold text-blue-500 font-mono">
              ${aggregateStats.totalPayrollEst.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Landmark className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* SEARCH, CONTROLS, AND NAVIGATION TAB */}
      <div className="bg-card-bg border border-main-border rounded-2xl p-4 md:p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Toggle between Live Monitor and Complete Ledger */}
        <div className="flex bg-app-bg p-1 rounded-xl border border-main-border/80 w-full md:w-auto shrink-0 gap-1 overflow-x-auto">
          <button
            onClick={() => setManagerTab('live')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              managerTab === 'live' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-muted-text hover:text-main-text'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Live Team Monitor</span>
          </button>
          <button
            onClick={() => setManagerTab('history')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              managerTab === 'history' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-muted-text hover:text-main-text'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Staff Ledger History</span>
          </button>
          <button
            onClick={() => setManagerTab('timeoff')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
              managerTab === 'timeoff' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-muted-text hover:text-main-text'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Time-Off Requests</span>
            {timeOffList.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white animate-pulse">
                {timeOffList.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setManagerTab('schedule')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              managerTab === 'schedule' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-muted-text hover:text-main-text'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Shift Scheduler</span>
          </button>
          <button
            onClick={() => setManagerTab('accounts')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              managerTab === 'accounts' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-muted-text hover:text-main-text'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>User Accounts ({allUsers.length})</span>
          </button>
        </div>

        {/* Search input field */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Filter staff, task or site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2 text-xs text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors"
          />
        </div>

        {/* Simulation trigger */}
        <button
          onClick={managerTab === 'timeoff' ? handleAddMockTimeOff : handleAddMockEmployee}
          className="w-full md:w-auto flex items-center justify-center gap-1.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 px-4 py-2 rounded-xl text-xs font-semibold text-blue-500 cursor-pointer transition shrink-0 animate-fade-in"
        >
          <PlusCircle className="h-4 w-4" />
          <span>
            {managerTab === 'timeoff' ? "Simulate Staff Time-Off Request" : "Simulate Mock Team Members"}
          </span>
        </button>

      </div>

      {/* RENDER ACTIVE TAB VIEW */}
      {managerTab === 'live' ? (
        
        /* TAB: LIVE TEAM MONITOR */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider font-mono">
              Live Workforce Map & Status Track
            </h3>
            <span className="text-[10px] font-mono text-muted-text">
              Auto-polls live activity every 5 seconds
            </span>
          </div>

          {/* Live Dashboard Filters */}
          <div className="flex flex-wrap items-center gap-2 bg-card-bg/40 p-2.5 rounded-2xl border border-main-border/30">
            <span className="text-[11px] text-muted-text font-mono mr-2 pl-1">Status Filter:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-app-bg text-muted-text hover:text-main-text border border-main-border hover:bg-main-border/10'
              }`}
            >
              All Employees ({userStats.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-app-bg text-emerald-500 hover:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/5'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Clocked In ({userStats.filter(u => u.isLive && !u.activeSession?.isOnBreak).length})
            </button>
            <button
              onClick={() => setStatusFilter('break')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1.5 ${
                statusFilter === 'break'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-app-bg text-amber-500 hover:text-amber-400 border border-amber-500/20 hover:bg-amber-500/5'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              On Break ({userStats.filter(u => u.isLive && u.activeSession?.isOnBreak).length})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1.5 ${
                statusFilter === 'offline'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-app-bg text-muted-text hover:text-main-text border border-main-border hover:bg-main-border/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              Offline ({userStats.filter(u => !u.isLive).length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStats.map((user) => {
              const active = user.activeSession;
              const isClocked = active ? active.isClockedIn : false;
              const isOnBreak = active ? active.isOnBreak : false;

              return (
                <div 
                  key={user.username} 
                  className={`bg-card-bg border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 ${
                    isClocked 
                      ? (isOnBreak ? 'border-amber-500/40 bg-amber-500/[0.01]' : 'border-emerald-500/40 bg-emerald-500/[0.01]') 
                      : 'border-main-border hover:border-main-border/80'
                  }`}
                >
                  <div>
                    {/* User Profile Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-main-border/30 pb-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-app-bg border border-main-border overflow-hidden shrink-0">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-text/50">
                              <User className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-main-text leading-tight">{user.fullName}</h4>
                          <span className="text-[10px] text-muted-text font-mono">@{user.username}</span>
                        </div>
                      </div>

                      {/* Status pill */}
                      {isClocked ? (
                        isOnBreak ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Break
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Active
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-app-bg px-2 py-0.5 text-[9px] font-bold text-muted-text border border-main-border uppercase tracking-wider">
                          Offline
                        </span>
                      )}
                    </div>

                    {/* Active Work Segment Details */}
                    {isClocked && active ? (
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-text uppercase font-mono block">Active Task</span>
                            <p className="text-xs font-semibold text-main-text leading-snug">{active.project}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-text uppercase font-mono block">GPS Location</span>
                            <p className="text-xs font-semibold text-main-text leading-none">{active.location}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-text uppercase font-mono block">Clock-In Time</span>
                            <p className="text-xs font-semibold text-main-text font-mono leading-none">{active.startTime}</p>
                          </div>
                        </div>

                        {active.notes && (
                          <div className="bg-app-bg/60 p-2.5 rounded-xl border border-main-border/40 mt-2 text-left">
                            <span className="text-[9px] text-muted-text uppercase font-mono block mb-1">Live Segment Memo</span>
                            <p className="text-xs text-muted-text italic leading-relaxed">"{active.notes}"</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 flex flex-col items-center justify-center text-center text-muted-text/50">
                        <Radio className="h-6 w-6 stroke-1 mb-1.5" />
                        <p className="text-xs font-mono">Not clocked in right now</p>
                        <p className="text-[10px] mt-1 max-w-[200px]">This contractor is off-shift. Live telemetry is locked.</p>
                      </div>
                    )}
                  </div>

                  {/* Estimated parameters */}
                  <div className="border-t border-main-border/30 pt-3.5 mt-3.5 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-muted-text">{user.department || 'General'}</span>
                      <span className="font-semibold text-main-text">${user.hourlyRate || 45}/hr</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-main-border/20">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono bg-app-bg/60 border border-main-border/30 px-2.5 py-1 rounded-xl">
                        <Lock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-muted-text">Pwd:</span>
                        <span className="font-bold text-main-text select-all">{user.password || '123456'}</span>
                      </div>
                      
                      {onLoginAsUser && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to log in as ${user.fullName}?`)) {
                              onLoginAsUser(user);
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 hover:border-blue-600 text-[11px] font-bold transition cursor-pointer"
                        >
                          <ArrowRight className="h-3 w-3" />
                          <span>Log In As</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-main-border/10">
                      <button
                        onClick={() => handleStartEditing(user)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-600 text-amber-500 hover:text-white border border-amber-500/20 hover:border-amber-600 text-[11px] font-bold transition cursor-pointer"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit Account</span>
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user.username)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 hover:border-red-600 text-[11px] font-bold transition cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredStats.length === 0 && (
              <div className="col-span-full bg-card-bg border border-main-border rounded-2xl p-8 text-center text-muted-text">
                <Search className="h-8 w-8 text-muted-text/40 mx-auto mb-2" />
                <p className="text-xs font-semibold">
                  No accounts found
                  {statusFilter !== 'all' && ` with status "${statusFilter}"`}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
                <p className="text-[10px] mt-1">Try simulating some mock employee accounts or adjusting your filter selection.</p>
              </div>
            )}
          </div>
        </div>

      ) : managerTab === 'history' ? (

        /* TAB: STAFF LEDGER HISTORY */
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider font-mono">
            Employee Workspace Audits & Timesheet Cards
          </h3>

          <div className="space-y-3">
            {filteredStats.map((user) => {
              const isExpanded = !!expandedUsers[user.username];
              
              return (
                <div key={user.username} className="bg-card-bg border border-main-border rounded-2xl shadow-lg overflow-hidden">
                  
                  {/* User row summary */}
                  <div 
                    onClick={() => toggleUserExpanded(user.username)}
                    className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-app-bg/25 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-app-bg border border-main-border overflow-hidden shrink-0">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-text/50">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-main-text">{user.fullName}</h4>
                          {user.department && (
                            <span className="hidden sm:inline-flex rounded-full bg-blue-500/5 border border-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-500 uppercase tracking-wider">
                              {user.department}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-text font-mono mt-0.5">@{user.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6">
                      {/* Hours */}
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-muted-text uppercase block">Hours Logged</span>
                        <span className="text-sm font-bold text-main-text font-mono">{user.totalHours.toFixed(2)} hrs</span>
                      </div>

                      {/* Pay rate */}
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-mono text-muted-text uppercase block">Contract Rate</span>
                        <span className="text-sm font-bold text-main-text font-mono">${user.hourlyRate || 45}/hr</span>
                      </div>

                      {/* Earnings */}
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-muted-text uppercase block">Payroll Estimate</span>
                        <span className="text-sm font-black text-blue-500 font-mono">
                          ${user.totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="text-muted-text/60">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable shift logs container */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-main-border/45 bg-app-bg/15"
                      >
                        <div className="p-4 md:p-6 space-y-4">
                          
                          <div className="flex justify-between items-center border-b border-main-border/30 pb-3">
                            <span className="text-xs font-bold text-muted-text uppercase tracking-wider font-mono">
                              Audit Segment Ledger Cards
                            </span>
                            <span className="text-[10px] font-mono text-muted-text">
                              {user.entries.length} segments recorded
                            </span>
                          </div>

                          <div className="divide-y divide-main-border/40">
                            {user.entries.map((entry) => (
                              <div key={entry.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 first:pt-0">
                                <div className="space-y-1.5 max-w-xl">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-main-text">
                                      {new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-app-bg px-2 py-0.5 text-[10px] font-medium text-main-text border border-main-border">
                                      <Briefcase className="h-3 w-3 text-blue-500" />
                                      Task: {entry.project}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-app-bg px-2 py-0.5 text-[10px] font-medium text-main-text border border-main-border">
                                      <MapPin className="h-3 w-3 text-blue-500" />
                                      Site: {entry.locationName}
                                    </span>
                                  </div>
                                  
                                  {entry.notes && (
                                    <p className="text-xs text-muted-text leading-relaxed">
                                      {entry.notes}
                                    </p>
                                  )}
                                  
                                  <p className="text-[11px] font-mono text-muted-text">
                                    Shift Segment: <strong className="text-muted-text/80">{entry.startTime} – {entry.endTime}</strong> (Break: {entry.breakMinutes} mins)
                                  </p>
                                </div>
                                
                                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0">
                                  <span className="text-xs font-semibold font-mono text-main-text">
                                    {entry.totalHours.toFixed(2)} hrs
                                  </span>
                                  <span className="text-[10px] font-mono text-muted-text uppercase">
                                    ${((entry.totalHours) * (user.hourlyRate || 45)).toLocaleString(undefined, { minimumFractionDigits: 2 })} est.
                                  </span>
                                </div>
                              </div>
                            ))}

                            {user.entries.length === 0 && (
                              <div className="py-6 text-center text-muted-text/60">
                                <p className="text-xs font-mono">No logged ledger segments on file for this user.</p>
                              </div>
                            )}
                          </div>

                          {/* Delete account administrative block */}
                          <div className="pt-4 border-t border-main-border/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-red-500/[0.02] p-4 rounded-xl border border-red-500/10 mt-2">
                            <div className="space-y-0.5 text-left">
                              <span className="text-xs font-bold text-red-500 uppercase tracking-wider font-mono">Administrative Control</span>
                              <p className="text-[10px] text-muted-text">Modify account permissions, pay details, or permanently delete this contractor.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {confirmDeleteUsername === user.username ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-red-400 font-medium">Are you sure?</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteUser(user.username);
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition"
                                  >
                                    Yes, Delete
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteUsername(null);
                                    }}
                                    className="bg-app-bg hover:bg-main-border/30 border border-main-border text-muted-text font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditing(user);
                                    }}
                                    className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-600 text-amber-500 hover:text-white border border-amber-500/20 hover:border-amber-600 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                    <span>Edit Account</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteUsername(user.username);
                                    }}
                                    className="flex items-center gap-1 bg-red-950/40 hover:bg-red-900/30 text-red-400 hover:text-red-300 border border-red-900/20 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete Account</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}

            {filteredStats.length === 0 && (
              <div className="bg-card-bg border border-main-border rounded-2xl p-8 text-center text-muted-text">
                <Search className="h-8 w-8 text-muted-text/40 mx-auto mb-2" />
                <p className="text-xs font-semibold">No staff audits matched "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>

      ) : (

        /* TAB: TIME-OFF REQUESTS & APPROVALS */
        <div className="space-y-4 animate-fade-in" id="time-off-requests-sub-tab">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-main-border/30 pb-3">
            <div>
              <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider font-mono">
                Employee Absence Management & Compliance Approvals
              </h3>
              <p className="text-[10px] text-muted-text mt-0.5">Visualize schedules, review pending requests, and file compliance decisions</p>
            </div>
            
            {/* View Selector Tabs */}
            <div className="flex bg-app-bg border border-main-border p-1 rounded-xl self-stretch sm:self-auto">
              <button
                onClick={() => setTimeOffViewMode('calendar')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeOffViewMode === 'calendar'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-text hover:text-main-text'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Calendar Matrix</span>
              </button>
              <button
                onClick={() => setTimeOffViewMode('list')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeOffViewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-text hover:text-main-text'
                }`}
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Inbox Ledger ({timeOffList.filter(r => r.status === 'pending').length})</span>
              </button>
            </div>
          </div>

          {timeOffViewMode === 'calendar' ? (
            <TimeOffCalendar requests={timeOffList} />
          ) : (
            <div className="space-y-4 text-left">
              {filteredTimeOffRequests.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isDenied = req.status === 'denied';

                // Unacknowledged warning for requests older than 30s for demo/hours for live
                const hasPassedTime = (Date.now() - new Date(req.createdAt).getTime()) > 30000;
                const isUnacknowledged = isPending && hasPassedTime;

                return (
                  <div 
                    key={req.id} 
                    className={`bg-card-bg border rounded-2xl p-5 shadow-lg space-y-4 transition-all duration-150 ${
                      isApproved 
                        ? 'border-emerald-500/30 bg-emerald-500/[0.01]' 
                        : isDenied 
                        ? 'border-red-500/30 bg-red-500/[0.01]' 
                        : isUnacknowledged
                        ? 'border-amber-500/50 bg-amber-500/[0.02] animate-pulse'
                        : 'border-main-border hover:border-main-border/80'
                    }`}
                  >
                    {/* Row Top Header Info */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-main-border/30 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-app-bg border border-main-border/80 flex items-center justify-center text-blue-500 text-xs font-extrabold uppercase font-mono shadow-sm">
                          {req.fullName.charAt(0)}
                        </div>
                        <div className="text-left">
                          <h4 className="text-xs font-extrabold text-main-text leading-tight">{req.fullName}</h4>
                          <p className="text-[10px] text-muted-text font-mono">@{req.username} • Submitted {new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-text bg-app-bg border border-main-border px-2.5 py-1 rounded-lg">
                          ID: {req.id}
                        </span>
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                            <CheckCircle2 className="h-3 w-3" />
                            Approved
                          </span>
                        ) : isDenied ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-500 border border-red-500/20 uppercase tracking-wider">
                            <X className="h-3 w-3" />
                            Denied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                            <Clock className="h-3 w-3" />
                            Pending Review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date range details and message content */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                      <div className="md:col-span-1 bg-app-bg/50 border border-main-border/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono uppercase text-muted-text font-bold block tracking-wider">Absence Interval</span>
                        <span className="text-xs font-extrabold text-main-text flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                          {new Date(req.startDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          {" – "}
                          {new Date(req.endDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                        </span>
                      </div>

                      <div className="md:col-span-2 bg-app-bg/50 border border-main-border/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono uppercase text-muted-text font-bold block tracking-wider font-mono">Submission Memo</span>
                        <p className="text-xs text-main-text italic">
                          "{req.reason}"
                        </p>
                      </div>
                    </div>

                    {/* Warning for unacknowledged request */}
                    {isPending && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left flex items-start gap-2.5 animate-pulse">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider font-mono">Warning: Request Unacknowledged</span>
                          <p className="text-[10px] text-muted-text leading-snug">This request has exceeded immediate workflow action windows. File compliance review status to satisfy the requester's calendar needs.</p>
                        </div>
                      </div>
                    )}

                    {/* Decision action interface */}
                    {isPending ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[10px] font-semibold text-muted-text uppercase font-mono">Review Note / Comments (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g., Request granted. Standard vacation pool balance will be debited."
                            value={decisionNotes[req.id] || ''}
                            onChange={(e) => setDecisionNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleTimeOffDecision(req.id, 'denied', req.fullName)}
                            className="bg-red-950/50 hover:bg-red-900/40 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition flex items-center gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Deny Absence</span>
                          </button>
                          <button
                            onClick={() => handleTimeOffDecision(req.id, 'approved', req.fullName)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-5 rounded-xl cursor-pointer transition flex items-center gap-1 shadow-md"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve Absence</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-app-bg/30 border border-main-border/40 rounded-xl p-3 text-left space-y-1">
                        <span className="text-[9px] font-mono uppercase text-blue-500 font-bold block">Decision Filed Record</span>
                        <p className="text-xs text-muted-text italic">
                          {req.managerNotes ? `"${req.managerNotes}"` : "Approved without custom notes."}
                        </p>
                        {req.respondedAt && (
                          <span className="text-[9px] font-mono text-muted-text block">
                            Processed: {new Date(req.respondedAt).toLocaleDateString()} at {new Date(req.respondedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}

              {filteredTimeOffRequests.length === 0 && (
                <div className="bg-card-bg border border-main-border rounded-2xl p-10 text-center text-muted-text">
                  <CalendarDays className="h-8 w-8 text-muted-text/30 mx-auto mb-2" />
                  <p className="text-xs font-semibold">No time-off requests matched your filter</p>
                  <p className="text-[10px] mt-1">To verify features, click "Simulate Staff Time-Off Request" above.</p>
                </div>
              )}
            </div>
          )}
        </div>

      )}

      {managerTab === 'schedule' && (
        <div className="space-y-6">
          <div className="bg-card-bg border border-main-border rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-main-border/40">
              <div className="text-left">
                <h2 className="text-lg font-bold text-main-text uppercase tracking-tight">Shift Scheduler Calendar</h2>
                <p className="text-xs text-muted-text">Assign, view, and organize future shifts for your team members</p>
              </div>
              
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrevMonth()}
                  className="p-2 border border-main-border bg-app-bg text-main-text rounded-xl hover:bg-main-border/30 transition cursor-pointer"
                  type="button"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
                <span className="text-sm font-bold text-main-text min-w-[140px] text-center font-mono uppercase">
                  {currentMonthName} {currentYear}
                </span>
                <button
                  onClick={() => handleNextMonth()}
                  className="p-2 border border-main-border bg-app-bg text-main-text rounded-xl hover:bg-main-border/30 transition cursor-pointer"
                  type="button"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid (left 2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-text uppercase font-mono tracking-wider">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    const dateStr = day.dateStr;
                    const isCurrentMonth = day.isCurrentMonth;
                    const isSelected = selectedDate === dateStr;
                    const dayShifts = futureShiftsList.filter(s => s.date === dateStr);
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`min-h-[100px] border rounded-xl p-2 text-left flex flex-col justify-between transition cursor-pointer ${
                          !isCurrentMonth 
                            ? 'bg-app-bg/20 border-main-border/30 text-muted-text/30' 
                            : isSelected
                            ? 'bg-blue-600/10 border-blue-500 text-main-text'
                            : 'bg-app-bg/50 border-main-border hover:bg-main-border/20 text-main-text'
                        }`}
                      >
                        <span className={`text-xs font-bold font-mono ${isSelected ? 'text-blue-500 font-extrabold' : ''}`}>
                          {day.dayNum}
                        </span>
                        
                        {/* Day's scheduled shifts list */}
                        <div className="mt-1 space-y-1 overflow-y-auto max-h-[70px] pr-0.5">
                          {dayShifts.map(s => {
                            const sName = s.fullName || 'Employee';
                            const sProj = s.project || 'General Shift';
                            const sStart = s.startTime || '09:00';
                            return (
                              <div
                                key={s.id}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold truncate"
                                title={`${sName}: ${sProj} (${sStart}-${s.endTime})`}
                              >
                                {sName.split(' ')[0]}: {sProj}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day details & Assign form (right 1 col) */}
              <div className="space-y-6">
                {/* Form to Assign Shift */}
                <div className="bg-app-bg/50 border border-main-border rounded-xl p-4 space-y-4 text-left">
                  <div className="flex items-center gap-2 pb-2 border-b border-main-border/30">
                    <PlusCircle className="h-4 w-4 text-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-main-text font-mono">
                      Assign Future Shift
                    </h3>
                  </div>

                  <form onSubmit={handleAssignShift} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Selected Date</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text font-mono focus:border-blue-500/40 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Assign Employee</label>
                      <select
                        value={assignUsername}
                        onChange={(e) => setAssignUsername(e.target.value)}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text focus:border-blue-500/40 focus:outline-none"
                        required
                      >
                        <option value="">-- Choose employee --</option>
                        {allUsers.filter(u => u.role !== 'manager').map(u => (
                          <option key={u.username} value={u.username}>
                            {u.fullName || u.username} (@{u.username})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Project / Task Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Framer Layout development"
                        value={assignProject}
                        onChange={(e) => setAssignProject(e.target.value)}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text focus:border-blue-500/40 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Start Time</label>
                        <input
                          type="time"
                          value={assignStartTime}
                          onChange={(e) => setAssignStartTime(e.target.value)}
                          className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text font-mono focus:border-blue-500/40 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-text uppercase font-mono">End Time</label>
                        <input
                          type="time"
                          value={assignEndTime}
                          onChange={(e) => setAssignEndTime(e.target.value)}
                          className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text font-mono focus:border-blue-500/40 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-text uppercase font-mono font-sans">Notes (Optional)</label>
                      <textarea
                        placeholder="Specific instructions or notes for the shift..."
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2 text-xs text-main-text focus:border-blue-500/40 focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 text-xs shadow-lg shadow-blue-500/15 cursor-pointer active:scale-[0.98] transition animate-fade-in"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Assign Shift</span>
                    </button>
                  </form>
                </div>

                {/* Day Details Box */}
                <div className="bg-app-bg/30 border border-main-border rounded-xl p-4 space-y-3 text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-main-border/30">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-main-text font-mono">
                        Shifts for {selectedDate}
                      </h3>
                    </div>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded-full font-mono">
                      {futureShiftsList.filter(s => s.date === selectedDate).length} Assigned
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {futureShiftsList.filter(s => s.date === selectedDate).map(s => {
                      const sName = s.fullName || 'Employee';
                      const sProj = s.project || 'General Shift';
                      return (
                        <div key={s.id} className="p-3 bg-card-bg border border-main-border rounded-xl flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <span className="text-xs font-bold text-main-text block truncate">{sName}</span>
                            <span className="text-[10px] text-muted-text block font-mono">
                              ⏰ {s.startTime} - {s.endTime}
                            </span>
                            <span className="text-[10px] text-blue-400 font-semibold block truncate">
                              💼 {sProj}
                            </span>
                            {s.notes && <p className="text-[10px] text-muted-text italic truncate mt-0.5">"{s.notes}"</p>}
                          </div>
                          
                          <button
                            onClick={() => handleDeleteShift(s.id)}
                            className="text-red-500/70 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
                            title="Delete assigned shift"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {futureShiftsList.filter(s => s.date === selectedDate).length === 0 && (
                      <div className="py-6 text-center text-muted-text/50">
                        <p className="text-xs">No future shifts assigned for this date.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {managerTab === 'accounts' && (
        <div className="space-y-6">
          <div className="bg-card-bg border border-main-border rounded-2xl p-5 shadow-xl">
            <div className="text-left pb-4 border-b border-main-border/40 mb-6">
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide font-mono">User Accounts Directory</h2>
              <p className="text-xs text-slate-400">Manage all registered user accounts, edit their department/rate/roles, and permanently delete accounts.</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-main-border/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#09090b]/80 border-b border-main-border text-muted-text font-mono uppercase tracking-wider">
                    <th className="p-4 font-semibold">User Details</th>
                    <th className="p-4 font-semibold">Department</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold font-mono">Rate / Hour</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main-border/40 text-slate-300">
                  {allUsers.map((userItem) => {
                    const isSelf = userItem.username === currentUser.username;
                    return (
                      <tr 
                        key={userItem.username} 
                        className="hover:bg-main-border/10 transition duration-150"
                      >
                        {/* User details */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-400 font-bold font-mono">
                              {userItem.firstName ? userItem.firstName[0].toUpperCase() : userItem.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                {userItem.fullName}
                                {isSelf && (
                                  <span className="text-[9px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">YOU</span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-text font-mono">@{userItem.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="p-4 font-medium text-slate-300">
                          {userItem.department || 'General'}
                        </td>

                        {/* Role */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            userItem.role === 'manager' 
                              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' 
                              : 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {userItem.role === 'manager' ? 'Management' : 'Employee'}
                          </span>
                        </td>

                        {/* Rate */}
                        <td className="p-4 font-mono font-medium text-slate-200">
                          ${userItem.hourlyRate || 45}/hr
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleStartEditing(userItem)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-main-border bg-app-bg hover:bg-main-border/30 text-xs font-semibold text-slate-200 transition cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            {!isSelf ? (
                              <div className="flex items-center">
                                {confirmDeleteUsername === userItem.username ? (
                                  <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/25 rounded-lg p-1">
                                    <span className="text-[10px] text-red-400 font-bold px-1 font-mono uppercase tracking-wider animate-pulse">Delete?</span>
                                    <button
                                      onClick={() => handleDeleteUser(userItem.username)}
                                      className="bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] px-2 py-1 rounded transition cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteUsername(null)}
                                      className="bg-[#09090B]/60 hover:bg-[#09090B]/80 text-slate-300 text-[10px] px-2 py-1 rounded transition cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteUsername(userItem.username)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-400 text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-text italic font-mono pr-2">Protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* EDIT USER ACCOUNT MODAL */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-card-bg border border-main-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-main-border/40 flex items-center justify-between bg-app-bg/50">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-main-text uppercase tracking-wide font-mono">
                    Edit Account details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-muted-text hover:text-main-text p-1.5 rounded-xl hover:bg-main-border/30 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveChanges} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase font-mono">First Name</label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Last Name</label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Username</label>
                  <input
                    type="text"
                    disabled
                    value={`@${editingUser.username}`}
                    className="w-full rounded-xl border border-main-border/50 bg-main-border/10 p-2.5 text-xs text-muted-text cursor-not-allowed font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Password</label>
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Hourly Pay Rate ($)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={editHourlyRate}
                      onChange={(e) => setEditHourlyRate(Number(e.target.value))}
                      className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Department</label>
                    <input
                      type="text"
                      required
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase font-mono">Job Privilege Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'employee' | 'manager')}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Management</option>
                  </select>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-main-border/30">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="bg-app-bg hover:bg-main-border/30 border border-main-border text-muted-text font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-5 rounded-xl cursor-pointer transition shadow-md flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
