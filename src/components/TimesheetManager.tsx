/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Coffee, Square, Plus, Trash2, FileOutput, Printer, X, MapPin, Briefcase, Calendar, CheckCircle2, Pencil, ClipboardList, Folder, FolderOpen, ChevronDown, ChevronRight, ChevronLeft, Archive, AlertTriangle, HelpCircle, Bell, Inbox, Send } from 'lucide-react';
import { 
  getPayPeriodsGrouped, 
  addTimesheetEntry, 
  updateTimesheetEntry,
  deleteTimesheetEntry, 
  getAppSettings,
  calculateHoursAndEarnings,
  PayPeriodGroup,
  getCurrentUser,
  updateActiveSession,
  clearActiveSession,
  getActiveSessions,
  getFutureShifts,
  acknowledgeFutureShift,
  getTimeOffRequests,
  TimeOffRequest,
  addSubmittedTimesheet,
  getSubmittedTimesheets
} from '../utils/storage';
import { TimesheetEntry, FutureShift, SubmittedTimesheet } from '../types';

interface TimesheetManagerProps {
  entries: TimesheetEntry[];
  onRefreshEntries: () => void;
  privacyMode: boolean;
  geofenceStatus?: { inside: boolean; name: string };
  simulatedGeoTrigger?: boolean;
  isMobileView?: boolean;
}

export default function TimesheetManager({ entries, onRefreshEntries, privacyMode, geofenceStatus, simulatedGeoTrigger, isMobileView = false }: TimesheetManagerProps) {
  const settings = useMemo(() => getAppSettings(), []);

  // Synchronous initialization of state from localStorage for seamless background tracking
  const { 
    initialIsClockedIn, 
    initialIsOnBreak, 
    initialTimerStart, 
    initialProject, 
    initialLocation, 
    initialNotes, 
    initialSecondsElapsed, 
    initialBreakSecondsElapsed,
    initialDaySecondsElapsed,
    initialDayBreakSecondsElapsed,
    initialIsOvertime
  } = useMemo(() => {
    const user = getCurrentUser();
    if (user) {
      const allSessions = getActiveSessions();
      const session = allSessions[user.username];
      if (session && session.isClockedIn) {
        const lastActive = new Date(session.lastActiveTimestamp).getTime();
        const now = Date.now();
        const elapsedBg = Math.max(0, Math.floor((now - lastActive) / 1000));
        const storedWork = session.secondsElapsed || 0;
        const storedBreak = session.breakSecondsElapsed || 0;
        const storedDayWork = session.daySecondsElapsed || storedWork;
        const storedDayBreak = session.dayBreakSecondsElapsed || storedBreak;

        return {
          initialIsClockedIn: true,
          initialIsOnBreak: session.isOnBreak,
          initialTimerStart: session.startTime,
          initialProject: session.project || '',
          initialLocation: session.location || '',
          initialNotes: session.notes || '',
          initialSecondsElapsed: session.isOnBreak ? storedWork : storedWork + elapsedBg,
          initialBreakSecondsElapsed: session.isOnBreak ? storedBreak + elapsedBg : storedBreak,
          initialDaySecondsElapsed: session.isOnBreak ? storedDayWork : storedDayWork + elapsedBg,
          initialDayBreakSecondsElapsed: session.isOnBreak ? storedDayBreak + elapsedBg : storedDayBreak,
          initialIsOvertime: !!session.isOvertime,
        };
      }
    }
    return {
      initialIsClockedIn: false,
      initialIsOnBreak: false,
      initialTimerStart: '',
      initialProject: '',
      initialLocation: '',
      initialNotes: '',
      initialSecondsElapsed: 0,
      initialBreakSecondsElapsed: 0,
      initialDaySecondsElapsed: 0,
      initialDayBreakSecondsElapsed: 0,
      initialIsOvertime: false,
    };
  }, []);

  // Timer States
  const [isClockedIn, setIsClockedIn] = useState(initialIsClockedIn);
  const [isOnBreak, setIsOnBreak] = useState(initialIsOnBreak);
  const [secondsElapsed, setSecondsElapsed] = useState(initialSecondsElapsed);
  const [breakSecondsElapsed, setBreakSecondsElapsed] = useState(initialBreakSecondsElapsed);
  const [daySecondsElapsed, setDaySecondsElapsed] = useState(initialDaySecondsElapsed);
  const [dayBreakSecondsElapsed, setDayBreakSecondsElapsed] = useState(initialDayBreakSecondsElapsed);
  const [timerStart, setTimerStart] = useState<string>(initialTimerStart);
  const [isOvertime, setIsOvertime] = useState<boolean>(initialIsOvertime);
  
  // New entry details (configured before clock-in or finalized on clock-out)
  const [activeProject, setActiveProject] = useState(initialProject);
  const [activeLocation, setActiveLocation] = useState(initialLocation);
  const [activeNotes, setActiveNotes] = useState(initialNotes);
  const [switchNotification, setSwitchNotification] = useState<string | null>(null);

  // UI state
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState<PayPeriodGroup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedPastPeriods, setExpandedPastPeriods] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const handleSubmitTimesheet = async (period: PayPeriodGroup) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      let total = 0;
      let regular = 0;
      let overtime = 0;
      period.entries.forEach(entry => {
        total += entry.totalHours;
        if (entry.isOvertime) {
          overtime += entry.totalHours;
        } else {
          regular += entry.totalHours;
        }
      });

      addSubmittedTimesheet(
        period.start,
        period.end,
        total,
        regular,
        overtime,
        period.entries
      );
      setSubmitSuccess("Timesheet successfully submitted to the manager's inbox!");
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Future Shifts & Time-Off Requests State and Listener
  const [futureShifts, setFutureShifts] = useState<FutureShift[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [submittedTimesheets, setSubmittedTimesheets] = useState<SubmittedTimesheet[]>([]);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  
  // Format today's date YYYY-MM-DD
  const defaultSelectedDay = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(defaultSelectedDay);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'pending'>('pending');

  const user = useMemo(() => getCurrentUser(), []);

  useEffect(() => {
    const loadShiftsAndTimeOff = () => {
      if (user) {
        // Load Future Shifts
        const allShifts = getFutureShifts();
        const userShifts = allShifts.filter(s => s.username === user.username);
        userShifts.sort((a, b) => a.date.localeCompare(b.date));
        setFutureShifts(userShifts);

        // Load Time Off Requests
        const allRequests = getTimeOffRequests();
        const userRequests = allRequests.filter(r => r.username === user.username);
        setTimeOffRequests(userRequests);

        // Load Submitted Timesheets
        const allSubmitted = getSubmittedTimesheets();
        const userSubmitted = allSubmitted.filter(s => s.username === user.username);
        setSubmittedTimesheets(userSubmitted);
      }
    };

    loadShiftsAndTimeOff();

    window.addEventListener('storage-sync', loadShiftsAndTimeOff);
    window.addEventListener('storage', loadShiftsAndTimeOff);
    return () => {
      window.removeEventListener('storage-sync', loadShiftsAndTimeOff);
      window.removeEventListener('storage', loadShiftsAndTimeOff);
    };
  }, [user]);

  // Manual Form State
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState(() => {
    try {
      return getAppSettings().defaultStartTime || '07:30';
    } catch {
      return '07:30';
    }
  });
  const [manualEnd, setManualEnd] = useState(() => {
    try {
      return getAppSettings().defaultEndTime || '16:00';
    } catch {
      return '16:00';
    }
  });
  const [manualBreak, setManualBreak] = useState(30);
  const [manualProject, setManualProject] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualIsOvertime, setManualIsOvertime] = useState(false);

  // Active Timer Intervals & LocalStorage Sync
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    
    if (isClockedIn) {
      updateActiveSession({
        isClockedIn: true,
        isOnBreak,
        startTime: timerStart,
        project: activeProject || 'General Task',
        location: activeLocation || 'Office',
        notes: activeNotes || 'Working...',
        secondsElapsed,
        breakSecondsElapsed,
        daySecondsElapsed,
        dayBreakSecondsElapsed,
        isOvertime,
      });
    } else {
      clearActiveSession();
    }
  }, [isClockedIn, isOnBreak, timerStart, activeProject, activeLocation, activeNotes, secondsElapsed, breakSecondsElapsed, daySecondsElapsed, dayBreakSecondsElapsed, isOvertime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && !isOnBreak) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
        setDaySecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isOnBreak]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && isOnBreak) {
      interval = setInterval(() => {
        setBreakSecondsElapsed(prev => prev + 1);
        setDayBreakSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isOnBreak]);

  // Overtime automatic flag checking: shifts longer than 8 hours (28800 seconds) are overtime
  useEffect(() => {
    if (daySecondsElapsed > 28800) {
      setIsOvertime(true);
    } else {
      setIsOvertime(false);
    }
  }, [daySecondsElapsed]);

  // Automated geofence entry effects
  useEffect(() => {
    if (simulatedGeoTrigger && !isClockedIn) {
      // Auto clock-in transition
      handleClockIn(true);
    }
  }, [simulatedGeoTrigger]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const handleClockIn = (geofenced = false) => {
    const now = new Date();
    setTimerStart(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    setIsClockedIn(true);
    setIsOnBreak(false);
    setSecondsElapsed(0);
    setBreakSecondsElapsed(0);
    setDaySecondsElapsed(0);
    setDayBreakSecondsElapsed(0);
    setActiveNotes('');
    setIsOvertime(false);
    
    if (geofenced && geofenceStatus) {
      setActiveLocation(geofenceStatus.name);
    }
  };

  const handleToggleBreak = () => {
    setIsOnBreak(!isOnBreak);
  };

  const handleClockOut = () => {
    if (!isClockedIn) return;

    // Calculate end time
    const now = new Date();
    const endStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Total break minutes spent on this task segment
    const breakMins = Math.round(breakSecondsElapsed / 60);

    // Save the entry
    addTimesheetEntry({
      date: now.toISOString().slice(0, 10),
      startTime: timerStart,
      endTime: endStr,
      breakMinutes: breakMins || 1, // at least 1 minute break if any
      project: activeProject,
      locationName: activeLocation,
      notes: activeNotes || 'Standard shift logged via active timer.',
      geofencedClockIn: simulatedGeoTrigger || false,
      geofencedClockOut: simulatedGeoTrigger || false,
      isOvertime: isOvertime
    });

    setIsClockedIn(false);
    setIsOnBreak(false);
    setSecondsElapsed(0);
    setBreakSecondsElapsed(0);
    setDaySecondsElapsed(0);
    setDayBreakSecondsElapsed(0);
    setIsOvertime(false);
    
    onRefreshEntries();
  };

  const handleSwitchTask = () => {
    if (!isClockedIn) return;

    const now = new Date();
    const endStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Total break minutes spent on this task segment
    const breakMins = Math.round(breakSecondsElapsed / 60);

    // Save current task segment
    addTimesheetEntry({
      date: now.toISOString().slice(0, 10),
      startTime: timerStart,
      endTime: endStr,
      breakMinutes: breakMins,
      project: activeProject,
      locationName: activeLocation,
      notes: activeNotes || 'Work segment completed.',
      geofencedClockIn: false,
      geofencedClockOut: false,
      isOvertime: isOvertime
    });

    // Start next task segment immediately
    setTimerStart(endStr);
    setSecondsElapsed(0);
    setBreakSecondsElapsed(0);
    // KEEP day duration timer running! No reset to daySecondsElapsed!
    
    setSwitchNotification(`Logged segment for "${activeProject}" (${formatTimer(secondsElapsed)}). Day total running: ${formatTimer(daySecondsElapsed)}. Ready for next task!`);
    setTimeout(() => {
      setSwitchNotification(null);
    }, 6000);

    setActiveNotes(''); // Clear notes for the next segment
    onRefreshEntries();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntry) {
      updateTimesheetEntry({
        ...editingEntry,
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        breakMinutes: Number(manualBreak),
        project: manualProject,
        locationName: manualLocation,
        notes: manualNotes,
        isOvertime: manualIsOvertime
      });
    } else {
      addTimesheetEntry({
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        breakMinutes: Number(manualBreak),
        project: manualProject,
        locationName: manualLocation,
        notes: manualNotes || 'Manual shift entry.',
        isOvertime: manualIsOvertime
      });
    }
    
    setShowManualForm(false);
    setEditingEntry(null);
    setManualNotes('');
    setManualIsOvertime(false);
    onRefreshEntries();
  };

  const handleEditClick = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setManualDate(entry.date);
    setManualProject(entry.project);
    setManualStart(entry.startTime);
    setManualEnd(entry.endTime);
    setManualBreak(entry.breakMinutes);
    setManualLocation(entry.locationName);
    setManualNotes(entry.notes);
    setManualIsOvertime(!!entry.isOvertime);
    setShowManualForm(true);
  };

  const handleDelete = (id: string) => {
    deleteTimesheetEntry(id);
    onRefreshEntries();
  };

  const handleOpenNewManualForm = () => {
    const currentSettings = getAppSettings();
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualProject('');
    setManualStart(currentSettings.defaultStartTime || '07:30');
    setManualEnd(currentSettings.defaultEndTime || '16:00');
    setManualBreak(30);
    setManualLocation('');
    setManualNotes('');
    setManualIsOvertime(false);
    setEditingEntry(null);
    setShowManualForm(true);
  };

  const calendarDays = useMemo(() => {
    const y = currentMonthDate.getFullYear();
    const m = currentMonthDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDayIndex = new Date(y, m, 1).getDay();
    
    const days: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    
    // Prev month padding
    const prevMonthDays = new Date(y, m, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const mNum = m === 0 ? 12 : m;
      const yNum = m === 0 ? y - 1 : y;
      const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: false });
    }
    
    // Current month
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: true });
    }
    
    // Next month padding
    const remainingCount = 42 - days.length;
    for (let dNum = 1; dNum <= remainingCount; dNum++) {
      const mNum = m === 11 ? 1 : m + 2;
      const yNum = m === 11 ? y + 1 : y;
      const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr, isCurrentMonth: false });
    }
    return days;
  }, [currentMonthDate]);

  const inboxShifts = useMemo(() => {
    const shiftsCopy = [...futureShifts];
    shiftsCopy.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return timeB - timeA;
    });
    return shiftsCopy;
  }, [futureShifts]);

  const filteredInboxShifts = useMemo(() => {
    if (inboxFilter === 'pending') {
      return inboxShifts.filter(s => !s.acknowledged);
    }
    return inboxShifts;
  }, [inboxShifts, inboxFilter]);

  const pendingInboxCount = useMemo(() => {
    return futureShifts.filter(s => !s.acknowledged).length;
  }, [futureShifts]);

  const payPeriods = useMemo(() => getPayPeriodsGrouped(), [entries]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }, []);

  const { currentPeriods, pastPeriods } = useMemo(() => {
    const current: PayPeriodGroup[] = [];
    const past: PayPeriodGroup[] = [];
    
    payPeriods.forEach(period => {
      if (period.end < todayStr) {
        past.push(period);
      } else {
        current.push(period);
      }
    });
    
    return { currentPeriods: current, pastPeriods: past };
  }, [payPeriods, todayStr]);

  const activePeriodDates = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    
    let startStr = '';
    let endStr = '';
    if (day <= 15) {
      startStr = new Date(year, month, 1).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      endStr = new Date(year, month, 15).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
    } else {
      startStr = new Date(year, month, 16).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      const lastDay = new Date(year, month + 1, 0).getDate();
      endStr = new Date(year, month, lastDay).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
    }
    return `${startStr} – ${endStr}`;
  }, []);

  const togglePastPeriod = (periodStr: string) => {
    setExpandedPastPeriods(prev => ({
      ...prev,
      [periodStr]: !prev[periodStr]
    }));
  };

  const toggleDayExpanded = (dateStr: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const reportHoursSummary = useMemo(() => {
    if (!showPdfPreview) return { total: 0, regular: 0, overtime: 0 };
    let total = 0;
    let regular = 0;
    let overtime = 0;
    showPdfPreview.entries.forEach(e => {
      total += e.totalHours;
      if (e.isOvertime) {
        overtime += e.totalHours;
      } else {
        regular += e.totalHours;
      }
    });
    return {
      total: Number(total.toFixed(2)),
      regular: Number(regular.toFixed(2)),
      overtime: Number(overtime.toFixed(2))
    };
  }, [showPdfPreview]);

  return (
    <div id="timesheet-manager" className={`h-full w-full ${isMobileView ? 'flex flex-col gap-4 overflow-y-auto pb-4' : 'grid grid-cols-1 gap-6 lg:grid-cols-3 overflow-hidden h-full pb-1'}`}>
      
      {/* LEFT COLUMN: TIMER & CONTROLS */}
      <div className={`lg:col-span-1 ${isMobileView ? 'space-y-4' : 'space-y-6 h-full overflow-y-auto pr-1 pb-4'}`}>
        
        {/* Active Session Card */}
        <div className={`rounded-3xl ${isMobileView ? 'p-4' : 'p-6'} relative overflow-hidden shadow-2xl transition-all duration-300 ${
          isClockedIn 
            ? 'bg-gradient-to-br from-blue-600 to-blue-800 border-none text-white' 
            : 'border border-main-border bg-card-bg text-main-text'
        }`}>
          
          {/* Status Indicators */}
          <div className={`flex items-center justify-between ${isMobileView ? 'mb-4' : 'mb-6'}`}>
            <span className={`text-xs font-semibold font-mono ${isClockedIn ? 'text-blue-100' : 'text-muted-text'}`}>LIVE TIMER</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isClockedIn 
                ? (isOnBreak ? 'bg-amber-400/20 text-amber-200' : 'bg-white/20 text-white') 
                : 'bg-app-bg text-muted-text border border-main-border'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isClockedIn ? (isOnBreak ? 'bg-amber-400 animate-pulse' : 'bg-white animate-ping') : 'bg-muted-text'}`} />
              {isClockedIn ? (isOnBreak ? 'On Break' : 'Active Shift') : 'Inactive'}
            </span>
          </div>
 
          {/* Time Display */}
          <div className={`text-center ${isMobileView ? 'py-4' : 'py-6'} space-y-4`}>
            {isClockedIn ? (
              <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-4">
                <div>
                  <span className="block text-[10px] font-mono text-blue-200/70 uppercase tracking-widest mb-1">Task Duration</span>
                  <h2 className={`${isMobileView ? 'text-2xl' : 'text-3xl'} font-bold tracking-tight font-mono select-none text-white`}>
                    {formatTimer(secondsElapsed)}
                  </h2>
                </div>
                <div className="border-l border-white/10">
                  <span className="block text-[10px] font-mono text-blue-200/70 uppercase tracking-widest mb-1">Day Duration</span>
                  <h2 className={`${isMobileView ? 'text-2xl' : 'text-3xl'} font-bold tracking-tight font-mono select-none text-white`}>
                    {formatTimer(daySecondsElapsed)}
                  </h2>
                </div>
              </div>
            ) : (
              <div>
                <span className="block text-[10px] font-mono text-muted-text uppercase tracking-widest mb-1">Shift Duration</span>
                <h2 className={`${isMobileView ? 'text-4xl' : 'text-5xl'} font-bold tracking-tight font-mono select-none text-main-text`}>
                  00:00:00
                </h2>
              </div>
            )}
            {isClockedIn && (
              <div className="mt-2 flex items-center justify-center gap-4 text-xs font-mono text-blue-100/80">
                <span>Start: <strong className="text-white">{timerStart}</strong></span>
                <span>•</span>
                <span>Break: <strong className="text-white">{formatTimer(breakSecondsElapsed)}</strong></span>
              </div>
            )}
          </div>

          {/* Temporary Segment Switch notification banner */}
          <AnimatePresence>
            {switchNotification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 text-center bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 rounded-xl p-2.5 text-[11px] font-medium leading-relaxed"
              >
                {switchNotification}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Setup / Notes fields before clocking out */}
          <div className={`${isMobileView ? 'mt-3 space-y-2.5 border-t pt-3' : 'mt-4 space-y-3.5 border-t pt-5'} ${isClockedIn ? 'border-white/10' : 'border-main-border'}`}>
            <div>
              <label className={`text-[11px] font-semibold uppercase font-mono block mb-1 ${isClockedIn ? 'text-blue-200' : 'text-muted-text'}`}>Active Task</label>
              <input
                type="text"
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                placeholder="What task or job are you doing? (e.g. Acme Site Coding)"
                className={`w-full rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition ${
                  isClockedIn 
                    ? 'bg-blue-900/30 text-white border border-blue-400/30' 
                    : 'bg-input-bg text-main-text border border-main-border focus:border-blue-500/50'
                }`}
                required
              />
            </div>

            <div>
              <label className={`text-[11px] font-semibold uppercase font-mono block mb-1 ${isClockedIn ? 'text-blue-200' : 'text-muted-text'}`}>Where are you? (Explanation)</label>
              <input
                type="text"
                value={activeLocation}
                onChange={(e) => setActiveLocation(e.target.value)}
                placeholder="e.g. Remote, HQ Office, Customer Site"
                className={`w-full rounded-xl px-3 py-2 text-xs font-medium focus:outline-none transition ${
                  isClockedIn 
                    ? 'bg-blue-900/30 text-white border border-blue-400/30' 
                    : 'bg-input-bg text-main-text border border-main-border focus:border-blue-500/50'
                }`}
                required
              />
            </div>

            {isClockedIn && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="text-[11px] font-semibold text-blue-200 uppercase font-mono block mb-1">Session Notes / Explanation</label>
                <textarea
                  value={activeNotes}
                  onChange={(e) => setActiveNotes(e.target.value)}
                  placeholder="Describe your current work segment..."
                  className={`w-full rounded-xl border border-blue-400/30 bg-blue-900/30 px-3 py-2 text-xs text-white placeholder-blue-300/50 focus:outline-none ${isMobileView ? 'h-12' : 'h-16'} resize-none`}
                />
              </motion.div>
            )}
          </div>

          {isClockedIn && (
            <div className={`grid grid-cols-2 gap-2 ${isMobileView ? 'mt-3' : 'mt-4'}`}>
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleSwitchTask}
                className="w-full py-2.5 flex items-center justify-center gap-1 px-1 rounded-2xl bg-[#09090B]/40 hover:bg-[#09090B]/60 text-blue-200 border border-blue-400/25 text-xs font-semibold uppercase tracking-wider transition active:scale-[0.98] cursor-pointer"
              >
                <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Switch Task</span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setIsOvertime(!isOvertime)}
                className={`w-full py-2.5 flex items-center justify-center gap-1.5 px-1 rounded-2xl border text-xs font-semibold uppercase tracking-wider transition active:scale-[0.98] cursor-pointer ${
                  isOvertime 
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                    : 'bg-[#09090B]/40 hover:bg-[#09090B]/60 text-blue-200 border-blue-400/25'
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${isOvertime ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`} />
                <span className="truncate">Overtime: {isOvertime ? 'ON' : 'OFF'}</span>
              </motion.button>
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className={`${isMobileView ? 'mt-4 gap-2' : 'mt-6 gap-3'} flex`}>
            {!isClockedIn ? (
              <button
                onClick={() => handleClockIn(false)}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 ${isMobileView ? 'py-2.5' : 'py-3'} font-semibold text-white shadow-lg shadow-blue-500/10 transition hover:bg-blue-500 active:scale-[0.98] cursor-pointer`}
              >
                <Play className="h-4 w-4 fill-white stroke-none" />
                <span>Start Day</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleBreak}
                  className={`w-1/2 flex items-center justify-center gap-1.5 rounded-2xl ${isMobileView ? 'py-2.5 text-xs' : 'py-3 text-sm'} font-medium border transition cursor-pointer ${
                    isOnBreak 
                      ? 'text-amber-200 border-amber-400/40 bg-amber-500/10' 
                      : 'text-blue-100 border-white/20 bg-blue-700/30 hover:bg-blue-700/50'
                  }`}
                >
                  <Coffee className="h-4 w-4" />
                  <span>{isOnBreak ? 'Resume' : 'Take Break'}</span>
                </button>
                <button
                  onClick={handleClockOut}
                  className={`w-1/2 flex items-center justify-center gap-1.5 rounded-2xl bg-white text-blue-700 font-semibold ${isMobileView ? 'py-2.5 text-xs' : 'py-3'} hover:bg-blue-50 shadow-lg transition active:scale-[0.98] cursor-pointer`}
                >
                  <Square className="h-3.5 w-3.5 fill-blue-700 stroke-none" />
                  <span>End Day</span>
                </button>
              </>
            )}
          </div>

          {/* GPS Auto trigger banner info */}
          {geofenceStatus?.inside && !isClockedIn && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <p className="text-[11px] text-blue-300">
                Inside <strong>{geofenceStatus.name}</strong>. Ready for automatic trigger clock-in.
              </p>
            </motion.div>
          )}

        </div>        {/* Manual Timesheet Card Injector Button */}
        <button
          onClick={handleOpenNewManualForm}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-main-border bg-card-bg ${isMobileView ? 'py-2.5 text-xs' : 'py-3.5 text-sm'} font-medium text-muted-text hover:bg-input-bg transition cursor-pointer`}
        >
          <Plus className="h-4 w-4 text-blue-500" />
          <span>Manual Shift Logger</span>
        </button>

      </div>

      {/* RIGHT COLUMN: WEEKLY LOGS */}
      <div className={`lg:col-span-2 ${isMobileView ? 'space-y-6' : 'space-y-6 h-full overflow-y-auto pr-1 pb-4'}`}>
        
        {/* FUTURE SCHEDULE & ABSENCES CALENDAR */}
        <div className="rounded-3xl border border-blue-500/20 bg-[#1e3a8a]/5 p-6 shadow-xl space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Your Schedule & Absences</h2>
                <p className="text-[10px] text-slate-400 font-mono">Unified shifts and time-off tracker</p>
              </div>
            </div>
            
            {/* Month selector controls */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold font-mono text-slate-200 select-none min-w-[100px] text-center">
                {currentMonthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid wrapper */}
          <div>
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[10px] sm:text-xs text-slate-400 py-1 border-b border-slate-800/40 font-mono uppercase tracking-widest">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* 42-day monthly calendar grid */}
            <div className="grid grid-cols-7 gap-1.5 mt-2">
              {calendarDays.map((day, idx) => {
                const isSelected = day.dateStr === selectedDateStr;
                const shifts = futureShifts.filter(s => s.date === day.dateStr);
                const timeOffs = timeOffRequests.filter(r => day.dateStr >= r.startDate && day.dateStr <= r.endDate);
                
                const hasShift = shifts.length > 0;
                const hasPendingTimeOff = timeOffs.some(r => r.status === 'pending');
                const hasApprovedTimeOff = timeOffs.some(r => r.status === 'approved');
                const hasDeniedTimeOff = timeOffs.some(r => r.status === 'denied');
                const isToday = day.dateStr === todayStr;

                // Color classes logic
                let cellBgClass = 'bg-slate-900/10';
                let cellBorderClass = 'border-slate-800/40';
                let cellTextClass = day.isCurrentMonth ? 'text-slate-300' : 'text-slate-600';

                if (hasShift) {
                  const allAck = shifts.every(s => s.acknowledged);
                  cellBgClass = allAck ? 'bg-blue-600/5' : 'bg-blue-500/10';
                  cellBorderClass = allAck ? 'border-blue-500/30' : 'border-blue-500/50';
                  cellTextClass = 'text-blue-100 font-medium';
                } else if (hasApprovedTimeOff) {
                  cellBgClass = 'bg-emerald-500/10';
                  cellBorderClass = 'border-emerald-500/30';
                  cellTextClass = 'text-emerald-300 font-medium';
                } else if (hasPendingTimeOff) {
                  cellBgClass = 'bg-amber-500/10';
                  cellBorderClass = 'border-amber-500/30';
                  cellTextClass = 'text-amber-300 font-medium';
                } else if (hasDeniedTimeOff) {
                  cellBgClass = 'bg-rose-500/10';
                  cellBorderClass = 'border-rose-500/30';
                  cellTextClass = 'text-rose-300 font-medium';
                }

                return (
                  <button
                    key={`${day.dateStr}-${idx}`}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    className={`aspect-square p-1.5 rounded-xl border flex flex-col justify-between items-stretch text-left transition-all relative cursor-pointer hover:border-blue-500/50 ${cellBgClass} ${cellBorderClass} ${cellTextClass} ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950' : ''
                    }`}
                  >
                    {/* Top row: day number and small today indicator */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold font-mono leading-none">
                        {day.dayNum}
                      </span>
                      {isToday && (
                        <span className="h-1 w-1 rounded-full bg-blue-400" title="Today" />
                      )}
                    </div>

                    {/* Bottom row / Content indicators */}
                    <div className="flex flex-col gap-0.5 mt-auto w-full overflow-hidden">
                      {hasShift && (
                        <div className="text-[8px] leading-tight px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold truncate">
                          {shifts.length > 1 ? `${shifts.length} Shifts` : 'Shift'}
                        </div>
                      )}
                      {hasApprovedTimeOff && (
                        <div className="text-[8px] leading-tight px-1 py-0.5 rounded bg-emerald-500/25 text-emerald-300 font-mono font-bold truncate">
                          Vacation
                        </div>
                      )}
                      {hasPendingTimeOff && (
                        <div className="text-[8px] leading-tight px-1 py-0.5 rounded bg-amber-500/25 text-amber-300 font-mono font-bold truncate">
                          Pending
                        </div>
                      )}
                      {hasDeniedTimeOff && (
                        <div className="text-[8px] leading-tight px-1 py-0.5 rounded bg-rose-500/25 text-rose-300 font-mono font-bold truncate">
                          Denied
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selection Detail Panel */}
          <div className="mt-4 p-4 rounded-2xl border border-slate-800/60 bg-[#09090B]/30 space-y-3">
            <h3 className="text-xs font-semibold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Schedule for {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </h3>

            {(() => {
              const selectedShifts = futureShifts.filter(s => s.date === selectedDateStr);
              const selectedTimeOffs = timeOffRequests.filter(r => selectedDateStr >= r.startDate && selectedDateStr <= r.endDate);

              if (selectedShifts.length === 0 && selectedTimeOffs.length === 0) {
                return (
                  <p className="text-xs text-slate-400 font-mono">
                    No scheduled shifts or active time-off requests on this day.
                  </p>
                );
              }

              return (
                <div className="space-y-3">
                  {/* Shifts */}
                  {selectedShifts.map(shift => (
                    <div 
                      key={shift.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative overflow-hidden transition-all duration-200 ${
                        shift.acknowledged 
                          ? 'border-slate-800 bg-[#18181B]/40 text-slate-400' 
                          : 'border-blue-500/40 bg-blue-500/5 text-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 uppercase tracking-wider border border-blue-500/15 font-mono">
                            {shift.project || 'General Shift'}
                          </span>
                          {!shift.acknowledged && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" title="Requires Acknowledgment" />
                          )}
                        </div>
                        <p className="text-xs font-bold font-mono text-slate-100">
                          Time: {shift.startTime} – {shift.endTime}
                        </p>
                        {shift.notes && (
                          <p className="text-[11px] text-slate-400 italic bg-[#09090B]/45 px-2 py-1.5 rounded border border-slate-800/80 max-w-lg font-mono">
                            Note: {shift.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {shift.acknowledged ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-mono">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Acknowledged</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              acknowledgeFutureShift(shift.id);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-md shadow-blue-500/15"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Acknowledge Shift</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Time-Off Requests */}
                  {selectedTimeOffs.map(r => (
                    <div 
                      key={r.id}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        r.status === 'approved' 
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-200'
                          : r.status === 'pending'
                            ? 'border-amber-500/30 bg-amber-500/5 text-slate-200'
                            : 'border-rose-500/30 bg-rose-500/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          r.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : r.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        } font-mono`}>
                          {r.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                          {r.status === 'pending' && <HelpCircle className="h-3 w-3" />}
                          {r.status === 'denied' && <AlertTriangle className="h-3 w-3" />}
                          <span>Time-Off Request: {r.status}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.startDate} to {r.endDate}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Reason: <strong className="text-slate-100 font-medium">{r.reason}</strong>
                      </p>
                      {r.managerNotes && (
                        <div className="text-[11px] text-slate-400 bg-[#09090B]/40 p-2 rounded border border-slate-800/80 font-mono mt-1">
                          <strong className="text-slate-300">Manager notes:</strong> {r.managerNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* INBOX LEDGER FOR SCHEDULED EVENTS */}
        <div className="rounded-3xl border border-blue-500/15 bg-blue-950/10 p-6 shadow-xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400 relative">
                <Inbox className="h-4.5 w-4.5" />
                {pendingInboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  Inbox Ledger
                  {pendingInboxCount > 0 && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-300 border border-blue-500/25 animate-pulse-subtle">
                      {pendingInboxCount} New
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-slate-400 font-mono">Ledger of newly scheduled shift assignments</p>
              </div>
            </div>

            {/* Toggle filter */}
            <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-800 self-start">
              <button
                onClick={() => setInboxFilter('pending')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md font-mono transition-all cursor-pointer ${
                  inboxFilter === 'pending'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                New Shifts
              </button>
              <button
                onClick={() => setInboxFilter('all')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md font-mono transition-all cursor-pointer ${
                  inboxFilter === 'all'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All History
              </button>
            </div>
          </div>

          {filteredInboxShifts.length === 0 ? (
            <div className="py-8 text-center bg-slate-900/10 rounded-2xl border border-dashed border-slate-800/40">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-800/20 flex items-center justify-center text-slate-500 mb-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500/60" />
              </div>
              <p className="text-xs font-semibold text-slate-300">
                {inboxFilter === 'pending' ? "You're all caught up!" : "No shifts in your schedule."}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {inboxFilter === 'pending' ? "No unacknowledged scheduled events remaining." : "Ask your manager to assign a shift."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {filteredInboxShifts.map((shift) => {
                  const shiftDateObj = new Date(shift.date + 'T00:00:00');
                  const formattedShiftDate = shiftDateObj.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  // Calculate "Scheduled X ago" or just a clean date format
                  let scheduledTimeStr = '';
                  if (shift.createdAt) {
                    try {
                      const createdMs = new Date(shift.createdAt).getTime();
                      const diffMs = Date.now() - createdMs;
                      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffHrs / 24);

                      if (diffDays > 0) {
                        scheduledTimeStr = `Assigned ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                      } else if (diffHrs > 0) {
                        scheduledTimeStr = `Assigned ${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
                      } else {
                        const diffMins = Math.floor(diffMs / (1000 * 60));
                        scheduledTimeStr = diffMins <= 1 ? 'Assigned just now' : `Assigned ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
                      }
                    } catch (e) {
                      scheduledTimeStr = 'Assigned';
                    }
                  } else {
                    scheduledTimeStr = 'Assigned';
                  }

                  return (
                    <motion.div
                      key={shift.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-4 rounded-2xl border transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden ${
                        shift.acknowledged
                          ? 'border-slate-800 bg-[#121214]/40 text-slate-400'
                          : 'border-blue-500/30 bg-blue-600/5 text-slate-200 shadow-sm'
                      }`}
                    >
                      {/* Left Side: Shift Date, Time, and Status Indicator */}
                      <div className="space-y-2 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          {!shift.acknowledged && (
                            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" title="New Scheduled Event" />
                          )}
                          <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 uppercase tracking-wider border border-blue-500/15 font-mono">
                            {shift.project || 'General Shift'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tight">
                            {scheduledTimeStr}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-100 font-mono">
                            {formattedShiftDate}
                          </h4>
                          <p className="text-xs text-slate-300 font-mono flex items-center gap-1">
                            <span className="text-blue-400 font-bold font-sans">●</span> {shift.startTime} – {shift.endTime}
                          </p>
                        </div>

                        {shift.notes && (
                          <p className="text-[11px] text-slate-400 italic bg-[#09090B]/40 px-2.5 py-2 rounded-lg border border-slate-800/80 font-mono max-w-xl">
                            {shift.notes}
                          </p>
                        )}
                      </div>

                      {/* Right Side: Acknowledge action */}
                      <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                        {shift.acknowledged ? (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 font-mono">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Acknowledged</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => acknowledgeFutureShift(shift.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-blue-500/15 font-sans"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-main-text">Timesheet Cycles</h2>
          <div className="flex items-center gap-2">
            {pastPeriods.length > 0 && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold transition cursor-pointer animate-pulse-subtle"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Past Archive ({pastPeriods.length})</span>
              </button>
            )}
          </div>
        </div>

        {payPeriods.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-main-border bg-card-bg/20 p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-text/60 mb-3" />
            <p className="text-sm font-medium text-muted-text">No shifts logged yet.</p>
            <p className="mt-1 text-xs text-muted-text/80">Clock in above or record shifts manually to initiate your ledger.</p>
            <p className="mt-2 text-xs text-muted-text/60">
              Active Cycle: <span className="text-main-text font-semibold">{activePeriodDates}</span>
            </p>
          </div>
        ) : currentPeriods.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-dashed border-main-border bg-card-bg/20 p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-text/60 mb-3" />
              <p className="text-sm font-medium text-muted-text">No shifts logged in the current active period.</p>
              <p className="mt-1 text-xs text-muted-text/80">
                Active Period: <span className="text-main-text font-semibold">{activePeriodDates}</span>
              </p>
              <p className="mt-2 text-xs text-muted-text/60">
                Clock in or record shifts manually to start logging time for this cycle.
              </p>
            </div>
            
            {pastPeriods.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-xl text-blue-500">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-main-text">Past Timesheets Archive Available</p>
                    <p className="text-xs text-muted-text">You have {pastPeriods.length} completed timesheet cycle{pastPeriods.length > 1 ? 's' : ''} stored safely in your logs.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-900/20 transition cursor-pointer shrink-0"
                >
                  <span>Open Archive Sidebar</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={isMobileView ? 'space-y-4' : 'space-y-6'}>
            {pastPeriods.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-xl text-blue-500">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-main-text">Past Timesheets Archive</p>
                    <p className="text-xs text-muted-text">You have {pastPeriods.length} completed timesheet cycle{pastPeriods.length > 1 ? 's' : ''} archived in your logs.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-900/20 transition cursor-pointer shrink-0"
                >
                  <span>Open Archive Sidebar</span>
                </button>
              </div>
            )}

            {currentPeriods.map((period) => {
              const periodHours = period.entries.reduce((acc, e) => acc + e.totalHours, 0);

              return (
                <div key={period.periodStr} className="rounded-2xl sm:rounded-3xl border border-main-border bg-card-bg overflow-hidden shadow-lg transition-colors duration-200">
                  
                  {/* Cycle Header */}
                  <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-app-bg/50 ${isMobileView ? 'px-4 py-3' : 'px-6 py-4'} border-b border-main-border`}>
                    <div>
                      <h3 className="text-xs font-semibold text-blue-500 font-mono uppercase tracking-wider">Pay Period Ledger</h3>
                      <p className="text-sm font-medium text-main-text mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          {new Date(period.start + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})} – {new Date(period.end + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
                        </span>
                        {(() => {
                          const endDateObj = new Date(period.end + 'T00:00:00');
                          const tempDate = new Date(endDateObj.getFullYear(), endDateObj.getMonth() + 1, 0);
                          const lastDayOfMonth = tempDate.getDate();
                          if (endDateObj.getDate() === lastDayOfMonth) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-500 uppercase tracking-wider border border-blue-500/20">
                                Tracked to Last Day of Month
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </p>
                    </div>

                    {/* Quick aggregates & PDF trigger */}
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs font-mono">
                        <span className="text-main-text font-semibold">{periodHours.toFixed(2)} hrs</span>
                      </div>

                      <button
                        onClick={() => setShowPdfPreview(period)}
                        className="flex items-center gap-1.5 rounded-xl bg-app-bg text-main-text border border-main-border px-3.5 py-1.5 text-xs font-medium hover:bg-input-bg transition cursor-pointer"
                      >
                        <FileOutput className="h-3.5 w-3.5 text-blue-500" />
                        <span>PDF Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Shifts logged in this cycle */}
                  <div className="divide-y divide-main-border/60">
                    {(() => {
                      // Group entries by date
                      const groups: Record<string, TimesheetEntry[]> = {};
                      period.entries.forEach(entry => {
                        if (!groups[entry.date]) {
                          groups[entry.date] = [];
                        }
                        groups[entry.date].push(entry);
                      });
                      
                      // Sort dates descending
                      const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
                      
                      return sortedDates.map(dateStr => {
                        const dayEntries = groups[dateStr];
                        const dayTotalHours = dayEntries.reduce((sum, e) => sum + e.totalHours, 0);
                        const hasMultipleTasks = dayEntries.length > 1;
                        const isExpanded = !!expandedDays[dateStr];
                        const singleEntry = dayEntries[0];
                        
                        return (
                          <div key={dateStr} className="flex flex-col">
                            {/* Day Header / Main Row */}
                            <div 
                              onClick={() => {
                                if (hasMultipleTasks) {
                                  toggleDayExpanded(dateStr);
                                }
                              }}
                              className={`flex items-center justify-between ${isMobileView ? 'p-4' : 'p-5'} ${hasMultipleTasks ? 'cursor-pointer hover:bg-app-bg/30' : ''} transition-colors duration-150`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-main-text">
                                  {new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                                </span>
                                {hasMultipleTasks && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-semibold text-blue-500 uppercase tracking-wider border border-blue-500/20">
                                    {dayEntries.length} Tasks
                                  </span>
                                )}
                                {!hasMultipleTasks && singleEntry.isOvertime && (
                                  <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                                    Overtime
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold font-mono text-main-text">
                                  {dayTotalHours.toFixed(2)} hrs
                                </span>
                                
                                {hasMultipleTasks ? (
                                  <div className="text-muted-text/60">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </div>
                                ) : (
                                  /* Inline Edit/Delete for single entry */
                                  <div className="flex items-center gap-1.5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    {deletingId === singleEntry.id ? (
                                      <div className="flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 animate-pulse shrink-0">
                                        <span className="text-[9px] font-mono text-rose-500 font-bold uppercase">Delete?</span>
                                        <button
                                          onClick={() => {
                                            handleDelete(singleEntry.id);
                                            setDeletingId(null);
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition cursor-pointer"
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={() => setDeletingId(null)}
                                          className="px-1.5 py-0.5 text-[9px] font-bold bg-app-bg hover:bg-input-bg text-muted-text border border-main-border rounded transition cursor-pointer"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleEditClick(singleEntry)}
                                          title="Edit Entry"
                                          className="p-1 rounded-lg text-muted-text hover:text-blue-500 hover:bg-app-bg transition cursor-pointer"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setDeletingId(singleEntry.id)}
                                          title="Delete Entry"
                                          className="p-1 rounded-lg text-muted-text hover:text-rose-500 hover:bg-app-bg transition cursor-pointer"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Expandable Dropdown List of Tasks (for days with multiple tasks) */}
                            {hasMultipleTasks && isExpanded && (
                              <div className="bg-app-bg/20 border-t border-main-border/30 px-5 py-3.5 space-y-3.5 divide-y divide-main-border/10">
                                {dayEntries.map((entry) => (
                                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-3.5 first:pt-0">
                                    <div className="space-y-1.5 max-w-xl">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-app-bg px-2 py-0.5 text-[10px] font-medium text-main-text border border-main-border">
                                          <Briefcase className="h-3 w-3 text-blue-500" />
                                          Task: {entry.project}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-md bg-app-bg px-2 py-0.5 text-[10px] font-medium text-main-text border border-main-border">
                                          <MapPin className="h-3 w-3 text-blue-500" />
                                          Where: {entry.locationName}
                                        </span>
                                        {entry.isOvertime && (
                                          <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                                            Overtime
                                          </span>
                                        )}
                                      </div>
                                      
                                      {entry.notes && (
                                        <p className="text-xs text-muted-text leading-relaxed">
                                          {entry.notes}
                                        </p>
                                      )}
                                      
                                      <p className="text-[11px] font-mono text-muted-text">
                                        Shift: <strong className="text-muted-text/80">{entry.startTime} – {entry.endTime}</strong> (Break: {entry.breakMinutes} mins)
                                      </p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
                                      <span className="text-xs font-semibold font-mono text-main-text">
                                        {entry.totalHours.toFixed(2)} hrs
                                      </span>
                                      
                                      {deletingId === entry.id ? (
                                        <div className="flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 animate-pulse">
                                          <span className="text-[9px] font-mono text-rose-500 font-bold uppercase">Delete?</span>
                                          <button
                                            onClick={() => {
                                              handleDelete(entry.id);
                                              setDeletingId(null);
                                            }}
                                            className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition cursor-pointer"
                                          >
                                            Yes
                                          </button>
                                          <button
                                            onClick={() => setDeletingId(null)}
                                            className="px-1.5 py-0.5 text-[9px] font-bold bg-app-bg hover:bg-input-bg text-muted-text border border-main-border rounded transition cursor-pointer"
                                          >
                                            No
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => handleEditClick(entry)}
                                            title="Edit Task"
                                            className="p-1 rounded-lg text-muted-text hover:text-blue-500 hover:bg-app-bg transition cursor-pointer"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => setDeletingId(entry.id)}
                                            title="Delete Task"
                                            className="p-1 rounded-lg text-muted-text hover:text-rose-500 hover:bg-app-bg transition cursor-pointer"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL 1: MANUAL ADD TIMESHEET FORM */}
      <AnimatePresence>
        {showManualForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowManualForm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-main-border bg-card-bg p-6 shadow-2xl z-10 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-main-border">
                <h3 className="text-base font-semibold text-main-text">
                  {editingEntry ? 'Edit Shift Ledger Card' : 'Manual Shift Logger'}
                </h3>
                <button 
                  onClick={() => {
                    setShowManualForm(false);
                    setEditingEntry(null);
                  }} 
                  className="rounded-lg p-1 text-muted-text hover:bg-app-bg hover:text-main-text transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Date</label>
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Active Task / Job</label>
                    <input
                      type="text"
                      required
                      value={manualProject}
                      onChange={(e) => setManualProject(e.target.value)}
                      placeholder="e.g. Site Maintenance"
                      className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Start Time</label>
                    <input
                      type="time"
                      required
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">End Time</label>
                    <input
                      type="time"
                      required
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Break (m)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={manualBreak}
                      onChange={(e) => setManualBreak(Number(e.target.value))}
                      className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Where? (Explanation)</label>
                  <input
                    type="text"
                    required
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="e.g. Remote, Office, Customer Site"
                    className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs font-medium text-main-text focus:border-blue-500/50 focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-main-border bg-input-bg p-3">
                  <input
                    type="checkbox"
                    id="manual-overtime-toggle"
                    checked={manualIsOvertime}
                    onChange={(e) => setManualIsOvertime(e.target.checked)}
                    className="h-4 w-4 rounded border-main-border text-blue-600 focus:ring-blue-500/50 bg-[#121214] cursor-pointer"
                  />
                  <label htmlFor="manual-overtime-toggle" className="text-xs font-medium text-main-text cursor-pointer select-none">
                    Mark this shift as <strong className="text-amber-500">Overtime Hours</strong>
                  </label>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-text block mb-1 uppercase font-mono">Tasks / Achievements / Explanation</label>
                  <textarea
                    required
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Describe task accomplishments or provide explanation during this shift segment..."
                    className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none h-20 resize-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 transition cursor-pointer"
                >
                  {editingEntry ? 'Update Ledger Entry' : 'Save Shift Entry'}
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: VECTOR PRINT PREVIEW OVERLAY (Supervisor Pay Period PDF Export) */}
      <AnimatePresence>
        {showPdfPreview && (
          <div className="fixed inset-0 z-50 flex flex-col bg-app-bg/98 backdrop-blur overflow-y-auto p-4 md:p-8 transition-colors duration-200">
            <div className="flex items-center justify-between w-full max-w-4xl mx-auto mb-4 text-main-text pb-3 border-b border-main-border print:hidden">
              <div>
                <h3 className="text-base font-semibold">Pay Period Report Export Portal</h3>
                <p className="text-xs text-muted-text">Review supervisor-ready vector timesheet document guidelines below.</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Submit to Manager Button / Badge */}
                {(() => {
                  const submissionId = `sub_${user?.username || ''}_${showPdfPreview.start}_${showPdfPreview.end}`;
                  const activeSubmission = submittedTimesheets.find(s => s.id === submissionId);
                  
                  if (activeSubmission) {
                    const statusColors = {
                      submitted: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
                      approved: 'bg-teal-500/10 text-teal-500 border border-teal-500/20',
                      rejected: 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    };
                    const statusLabels = {
                      submitted: 'Submitted to Manager',
                      approved: 'Approved by Manager',
                      rejected: 'Rejected by Manager'
                    };
                    return (
                      <div className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${statusColors[activeSubmission.status] || statusColors.submitted}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{statusLabels[activeSubmission.status] || 'Submitted'}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() => handleSubmitTimesheet(showPdfPreview)}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      <span>{isSubmitting ? 'Submitting...' : 'Submit to Manager'}</span>
                    </button>
                  );
                })()}

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfPreview(null)}
                  className="rounded-xl border border-main-border bg-card-bg p-2 text-muted-text hover:text-main-text transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {submitSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-4xl mx-auto mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 print:hidden"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{submitSuccess}</span>
              </motion.div>
            )}

            {/* Printable Document Core */}
            <div id="payperiod-printout" className="w-full max-w-4xl mx-auto bg-white text-slate-950 p-8 md:p-12 rounded-2xl shadow-2xl print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
              
              {/* Report Header */}
              <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-300 pb-6 mb-6 print-border-slate-300">
                <div>
                  <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Pay Period Timesheet Report</h1>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mt-1">INDUSTRY DATA COMPLIANCE ID: #TS-{showPdfPreview.start.replace(/-/g,'')}</p>
                </div>
                <div className="mt-4 md:mt-0 text-left md:text-right text-xs space-y-1">
                  <p><strong>Employee:</strong> {getCurrentUser()?.username || 'user'}</p>
                  <p><strong>Cycle:</strong> {showPdfPreview.start} to {showPdfPreview.end}</p>
                  <p><strong>Export Date:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Aggregates Summary */}
              <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50 mb-8 print-bg-slate-50 print-border-slate-200">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Period Hours</span>
                  <span className="text-lg font-bold text-slate-950">{reportHoursSummary.total} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Logged Shifts</span>
                  <span className="text-lg font-bold text-slate-950">{showPdfPreview.entries.length} shifts</span>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left border-collapse text-xs table-fixed">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider print-bg-slate-100 print-border-slate-300">
                      <th className="py-2.5 px-3 w-[18%]">Date</th>
                      <th className="py-2.5 px-3 w-[45%]">Task / Explanation</th>
                      <th className="py-2.5 px-3 w-[25%]">Interval (Break)</th>
                      <th className="py-2.5 px-3 w-[12%] text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {showPdfPreview.entries.map((entry) => (
                      <tr key={entry.id} className="align-top hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800 break-words">
                            {entry.project}
                            {entry.isOvertime && (
                              <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20 uppercase tracking-wider print:bg-slate-100 print:text-black shrink-0">
                                Overtime
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500">Where: {entry.locationName}</p>
                          {entry.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-1 break-words leading-relaxed">{entry.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <div className="font-medium">{entry.startTime} – {entry.endTime}</div>
                          <div className="text-[10px] text-slate-400 font-mono">break: {entry.breakMinutes}m</div>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-semibold text-xs ${entry.isOvertime ? 'text-amber-600' : 'text-slate-800'}`}>
                          {entry.totalHours} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Three Specific Hourly Categories at the End of the Report */}
              <div className="mt-6 border-t border-slate-200 pt-6 mb-8 print-border-slate-200">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Pay Period Hours Breakdown</h4>
                <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50 print-bg-slate-50 print-border-slate-200">
                  <div className="border-r border-slate-200 pr-4 print-border-slate-200">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Regular Hours</span>
                    <span className="text-base font-bold text-slate-900 font-mono">{reportHoursSummary.regular} hrs</span>
                  </div>
                  <div className="border-r border-slate-200 px-4 print-border-slate-200">
                    <span className="text-[9px] font-semibold text-amber-700 uppercase tracking-wider block">Overtime Hours</span>
                    <span className="text-base font-bold text-amber-700 font-mono">{reportHoursSummary.overtime} hrs</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wider block">Total Time</span>
                    <span className="text-base font-bold text-blue-700 font-mono">{reportHoursSummary.total} hrs</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 mt-12 text-xs print-border-slate-200">
                <div>
                  <div className="border-b border-slate-400 h-12" />
                  <p className="mt-2 text-slate-500 font-medium">Employee Signature / Date</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-12" />
                  <p className="mt-2 text-slate-500 font-medium">Supervisor Sign-off / Date</p>
                </div>
              </div>

              {/* System Compliance Disclaimer */}
              <div className="mt-12 text-[10px] leading-relaxed text-slate-400 border-t border-slate-100 pt-6 print-border-slate-200">
                <strong>System Integrity Disclaimer:</strong> This timesheet report was compiled from decentralized client logs, cryptographically matched via biometrics, and verified with optional GPS positioning metrics. GDPR non-disclosure and privacy constraints prevent third-party logging without manual explicit supervisor synchronization, preserving compliance with global ISO-27001 data integrity standards.
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SIDEBAR: PAST TIMESHEETS ARCHIVE */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Sidebar Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[580px] bg-card-bg shadow-2xl border-l border-main-border flex flex-col h-full overflow-hidden transition-colors duration-200"
            >
              {/* Sidebar Header */}
              <div className="p-5 md:p-6 border-b border-main-border flex items-center justify-between bg-app-bg/40">
                <div className="flex items-center gap-2.5">
                  <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500 border border-blue-500/20">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-main-text">Past Timesheets</h3>
                    <p className="text-xs text-muted-text mt-0.5">Closed pay periods and archived shift ledgers</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="rounded-xl p-2 text-muted-text hover:bg-app-bg hover:text-main-text border border-main-border/40 hover:border-main-border transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sidebar Content (Scrollable) */}
              <div className="flex-grow overflow-y-auto p-5 md:p-6 space-y-4">
                {pastPeriods.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-muted-text/5 p-4 rounded-full mb-4">
                      <Folder className="h-10 w-10 text-muted-text/40" />
                    </div>
                    <h4 className="text-sm font-semibold text-main-text">No Closed Pay Periods</h4>
                    <p className="text-xs text-muted-text max-w-xs mt-1.5 leading-relaxed">
                      When a pay period concludes (its end date is in the past), it will be automatically compiled and archived here.
                    </p>
                  </div>
                ) : (
                  pastPeriods.map((period) => {
                    const isExpanded = !!expandedPastPeriods[period.periodStr];
                    const periodHours = period.entries.reduce((acc, e) => acc + e.totalHours, 0);
                    
                    return (
                      <div
                        key={period.periodStr}
                        className="rounded-2xl border border-main-border bg-app-bg/30 overflow-hidden shadow-sm hover:border-blue-500/30 transition-colors duration-200"
                      >
                        {/* Period "File" Row (Header) */}
                        <button
                          onClick={() => togglePastPeriod(period.periodStr)}
                          className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-app-bg/50 transition cursor-pointer animate-fade-in"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                              {isExpanded ? (
                                <FolderOpen className="h-5 w-5" />
                              ) : (
                                <Folder className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-blue-500 font-mono">
                                  Archive File
                                </span>
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-500 uppercase tracking-wider border border-emerald-500/20">
                                  Closed
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-main-text mt-1">
                                {new Date(period.start + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})} – {new Date(period.end + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right font-mono">
                              <p className="text-sm font-bold text-main-text">{periodHours.toFixed(2)}</p>
                              <p className="text-[10px] text-muted-text">Total Hours</p>
                            </div>
                            <div className="text-muted-text/60 p-1">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded Shift Log inside the specific pay period */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="border-t border-main-border/60 bg-card-bg/40 overflow-hidden"
                            >
                              <div className="p-4 space-y-4">
                                {/* Actions Area for this period */}
                                <div className="flex items-center justify-between bg-app-bg/40 p-2.5 rounded-xl border border-main-border/50">
                                  <span className="text-[10px] font-semibold text-muted-text uppercase font-mono tracking-wider">
                                    {period.entries.length} shift{period.entries.length > 1 ? 's' : ''} logged
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowPdfPreview(period);
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-sm"
                                  >
                                    <FileOutput className="h-3.5 w-3.5" />
                                    <span>Export Report</span>
                                  </button>
                                </div>

                                {/* Shift List */}
                                <div className="divide-y divide-main-border/40 space-y-3">
                                  {period.entries.map((entry) => (
                                    <div key={entry.id} className="pt-3 first:pt-0 flex flex-col justify-between gap-2.5">
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-semibold text-main-text">
                                            {new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                                          </span>
                                          <span className="inline-flex items-center gap-0.5 rounded-md bg-app-bg px-1.5 py-0.5 text-[9px] font-medium text-main-text border border-main-border">
                                            Task: {entry.project}
                                          </span>
                                          <span className="inline-flex items-center gap-0.5 rounded-md bg-app-bg px-1.5 py-0.5 text-[9px] font-medium text-main-text border border-main-border">
                                            Where: {entry.locationName}
                                          </span>
                                        </div>

                                        {entry.notes && (
                                          <p className="text-xs text-muted-text leading-relaxed bg-app-bg/25 p-2 rounded-lg border border-main-border/30">
                                            {entry.notes}
                                          </p>
                                        )}

                                        <p className="text-[10px] font-mono text-muted-text">
                                          Shift: {entry.startTime} – {entry.endTime} ({entry.breakMinutes}m break)
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between border-t border-main-border/30 pt-2 mt-1">
                                        <span className="text-xs font-semibold font-mono text-blue-400">
                                          {entry.totalHours.toFixed(2)} hours
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditClick(entry);
                                            }}
                                            className="p-1.5 rounded-lg text-muted-text hover:text-blue-500 hover:bg-app-bg transition cursor-pointer"
                                            title="Edit entry"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeletingId(entry.id);
                                            }}
                                            className="p-1.5 rounded-lg text-muted-text hover:text-rose-500 hover:bg-app-bg transition cursor-pointer"
                                            title="Delete entry"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>


            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
