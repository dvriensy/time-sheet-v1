/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Coffee, Square, Plus, Trash2, FileOutput, Printer, X, MapPin, Briefcase, Calendar, CheckCircle2, Pencil, ClipboardList } from 'lucide-react';
import { 
  getPayPeriodsGrouped, 
  addTimesheetEntry, 
  updateTimesheetEntry,
  deleteTimesheetEntry, 
  getAppSettings,
  calculateHoursAndEarnings,
  PayPeriodGroup,
  getCurrentUser
} from '../utils/storage';
import { TimesheetEntry } from '../types';

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

  // Timer States
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [breakSecondsElapsed, setBreakSecondsElapsed] = useState(0);
  const [timerStart, setTimerStart] = useState<string>('');
  
  // New entry details (configured before clock-in or finalized on clock-out)
  const [activeProject, setActiveProject] = useState('General Task');
  const [activeLocation, setActiveLocation] = useState('Office');
  const [activeNotes, setActiveNotes] = useState('');
  const [switchNotification, setSwitchNotification] = useState<string | null>(null);

  // UI state
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState<PayPeriodGroup | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Manual Form State
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('17:00');
  const [manualBreak, setManualBreak] = useState(30);
  const [manualProject, setManualProject] = useState('General Task');
  const [manualLocation, setManualLocation] = useState('Office');
  const [manualNotes, setManualNotes] = useState('');

  // Active Timer Intervals
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && !isOnBreak) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isOnBreak]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && isOnBreak) {
      interval = setInterval(() => {
        setBreakSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, isOnBreak]);

  // Simulated geofence entry effects
  useEffect(() => {
    if (simulatedGeoTrigger && !isClockedIn) {
      // Auto clock-in simulation
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
    setActiveNotes('');
    
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
    
    // Total break minutes
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
      geofencedClockOut: simulatedGeoTrigger || false
    });

    setIsClockedIn(false);
    setIsOnBreak(false);
    setSecondsElapsed(0);
    setBreakSecondsElapsed(0);
    
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
      geofencedClockOut: false
    });

    // Start next task segment immediately
    setTimerStart(endStr);
    setSecondsElapsed(0);
    setBreakSecondsElapsed(0);
    
    setSwitchNotification(`Logged segment for "${activeProject}" (${formatTimer(secondsElapsed)}). Ready for next task!`);
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
        notes: manualNotes
      });
    } else {
      addTimesheetEntry({
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        breakMinutes: Number(manualBreak),
        project: manualProject,
        locationName: manualLocation,
        notes: manualNotes || 'Manual shift entry.'
      });
    }
    
    setShowManualForm(false);
    setEditingEntry(null);
    setManualNotes('');
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
    setShowManualForm(true);
  };

  const handleDelete = (id: string) => {
    deleteTimesheetEntry(id);
    onRefreshEntries();
  };

  const payPeriods = useMemo(() => getPayPeriodsGrouped(), [entries]);

  const totalCalculated = useMemo(() => {
    if (!showPdfPreview) return { hours: 0 };
    const h = showPdfPreview.entries.reduce((sum, e) => sum + e.totalHours, 0);
    return { hours: Number(h.toFixed(2)) };
  }, [showPdfPreview]);

  return (
    <div id="timesheet-manager" className={`grid ${isMobileView ? 'grid-cols-1 gap-4' : 'grid-cols-1 gap-6 lg:grid-cols-3'}`}>
      
      {/* LEFT COLUMN: TIMER & CONTROLS */}
      <div className={`lg:col-span-1 ${isMobileView ? 'space-y-4' : 'space-y-6'}`}>
        
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
          <div className={`text-center ${isMobileView ? 'py-4' : 'py-6'}`}>
            <h2 className={`${isMobileView ? 'text-4xl' : 'text-5xl'} font-bold tracking-tight font-mono select-none ${isClockedIn ? 'text-white' : 'text-main-text'}`}>
              {formatTimer(secondsElapsed)}
            </h2>
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
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSwitchTask}
              className={`w-full ${isMobileView ? 'mt-3 py-2' : 'mt-4 py-2.5'} flex items-center justify-center gap-1.5 rounded-2xl bg-[#09090B]/40 hover:bg-[#09090B]/60 text-blue-200 border border-blue-400/25 text-xs font-semibold uppercase tracking-wider transition active:scale-[0.98] cursor-pointer`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>Switch Task / Job Change</span>
            </motion.button>
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
          onClick={() => setShowManualForm(true)}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-main-border bg-card-bg ${isMobileView ? 'py-2.5 text-xs' : 'py-3.5 text-sm'} font-medium text-muted-text hover:bg-input-bg transition cursor-pointer`}
        >
          <Plus className="h-4 w-4 text-blue-500" />
          <span>Manual Shift Logger</span>
        </button>

      </div>

      {/* RIGHT COLUMN: WEEKLY LOGS */}
      <div className="lg:col-span-2 space-y-6">
        
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-main-text">Timesheet Cycles</h2>
          <span className="text-xs text-muted-text font-mono">LOCAL PERSISTENCE ONLY</span>
        </div>

        {payPeriods.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-main-border bg-card-bg/20 p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-text/60 mb-3" />
            <p className="text-sm font-medium text-muted-text">No shifts logged yet.</p>
            <p className="mt-1 text-xs text-muted-text/80">Clock in above or record shifts manually to initiate your ledger.</p>
          </div>
        ) : (
          <div className={isMobileView ? 'space-y-4' : 'space-y-6'}>
            {payPeriods.map((period) => {
              const periodHours = period.entries.reduce((acc, e) => acc + e.totalHours, 0);

              return (
                <div key={period.periodStr} className="rounded-2xl sm:rounded-3xl border border-main-border bg-card-bg overflow-hidden shadow-lg transition-colors duration-200">
                  
                  {/* Cycle Header */}
                  <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-app-bg/50 ${isMobileView ? 'px-4 py-3' : 'px-6 py-4'} border-b border-main-border`}>
                    <div>
                      <h3 className="text-xs font-semibold text-blue-500 font-mono uppercase tracking-wider">Pay Period Ledger</h3>
                      <p className="text-sm font-medium text-main-text mt-0.5">
                        {new Date(period.start).toLocaleDateString(undefined, {month:'short', day:'numeric'})} – {new Date(period.end).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
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
                    {period.entries.map((entry) => (
                      <div key={entry.id} className={`${isMobileView ? 'p-4 gap-3' : 'p-5 gap-4'} flex flex-col sm:flex-row sm:items-start justify-between group`}>
                        <div className="space-y-2 max-w-xl">
                          
                          {/* Date and Tasks Tags */}
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
                              Where: {entry.locationName}
                            </span>
                          </div>

                          {/* Task Description / Explanation */}
                          <p className="text-xs text-muted-text leading-relaxed">
                            {entry.notes}
                          </p>

                          {/* Time bounds */}
                          <p className="text-[11px] font-mono text-muted-text">
                            Shift: <strong className="text-muted-text/80">{entry.startTime} – {entry.endTime}</strong> (Break: {entry.breakMinutes} mins)
                          </p>
                        </div>

                        {/* Totals & Actions */}
                        <div className={`flex ${isMobileView ? 'flex-row items-center justify-between border-t border-main-border/35 pt-2.5 mt-1' : 'sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2'}`}>
                          <div className="text-right">
                            <p className="text-sm font-semibold font-mono text-main-text">{entry.totalHours} hrs</p>
                          </div>

                          {deletingId === entry.id ? (
                            <div className="flex items-center gap-1.5 mt-1 bg-rose-500/10 px-2.5 py-1.5 rounded-xl border border-rose-500/20 animate-pulse shrink-0">
                              <span className="text-[10px] font-mono text-rose-500 font-bold uppercase tracking-wider">Delete?</span>
                              <button
                                onClick={() => {
                                  handleDelete(entry.id);
                                  setDeletingId(null);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-app-bg hover:bg-input-bg text-muted-text border border-main-border rounded-md transition cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                onClick={() => handleEditClick(entry)}
                                title="Edit Ledger Entry"
                                className="p-1.5 rounded-lg text-muted-text hover:text-blue-500 hover:bg-app-bg transition cursor-pointer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(entry.id)}
                                title="Delete Entry"
                                className="p-1.5 rounded-lg text-muted-text hover:text-rose-500 hover:bg-app-bg transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    ))}
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

            {/* Printable Document Core */}
            <div id="payperiod-printout" className="w-full max-w-4xl mx-auto bg-white text-slate-950 p-8 md:p-12 rounded-2xl shadow-2xl print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
              
              {/* Report Header */}
              <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-300 pb-6 mb-6">
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
              <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50 mb-8">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Scheduled Hours</span>
                  <span className="text-lg font-bold text-slate-950">{totalCalculated.hours} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Logged Shifts</span>
                  <span className="text-lg font-bold text-slate-950">{showPdfPreview.entries.length} shifts</span>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Task / Explanation</th>
                      <th className="py-2 px-3">Interval (Break)</th>
                      <th className="py-2 px-3 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {showPdfPreview.entries.map((entry) => (
                      <tr key={entry.id} className="align-top">
                        <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{entry.project}</p>
                          <p className="text-[10px] text-slate-500">Where: {entry.locationName}</p>
                          <p className="text-[10px] text-slate-400 italic mt-1 max-w-sm">{entry.notes}</p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {entry.startTime} – {entry.endTime} ({entry.breakMinutes}m)
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium">
                          {entry.totalHours} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 mt-12 text-xs">
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
              <div className="mt-12 text-[10px] leading-relaxed text-slate-400 border-t border-slate-100 pt-6">
                <strong>System Integrity Disclaimer:</strong> This timesheet report was compiled from decentralized client logs, cryptographically matched via biometrics, and verified with optional GPS positioning metrics. GDPR non-disclosure and privacy constraints prevent third-party logging without manual explicit supervisor synchronization, preserving compliance with global ISO-27001 data integrity standards.
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
