/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Calendar, Users, Info, 
  CheckCircle2, Clock, AlertCircle, FileText, UserMinus
} from 'lucide-react';
import { TimeOffRequest } from '../utils/storage';

interface TimeOffCalendarProps {
  requests: TimeOffRequest[];
}

// Timezone-safe local date parser
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
}

// Check if a date falls within inclusive YYYY-MM-DD range
function isDateWithinRange(date: Date, startStr: string, endStr: string): boolean {
  const checkTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startTime = parseLocalDate(startStr).getTime();
  const endTime = parseLocalDate(endStr).getTime();
  return checkTime >= startTime && checkTime <= endTime;
}

export default function TimeOffCalendar({ requests }: TimeOffCalendarProps) {
  // Initialize to current month (June 2026 based on mock system context)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(2026, 5, 30)); // June 2026
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date(2026, 5, 30));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    setCurrentMonth(new Date(2026, 5, 30));
    setSelectedDate(new Date(2026, 5, 30));
  };

  // Generate days in monthly grid (42 days grid: 6 weeks)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay(); // 0 is Sunday, 6 is Saturday
    
    const days: Date[] = [];
    
    // Fill previous month padding days
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Fill current month days
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Fill next month padding days to complete 42 cells (6 rows * 7 days)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [year, month]);

  // Find requests matching each calendar cell
  const getAbsencesForDate = (date: Date) => {
    return requests.filter(req => isDateWithinRange(date, req.startDate, req.endDate));
  };

  // List of requests on the selected date
  const selectedDateRequests = useMemo(() => {
    if (!selectedDate) return [];
    return getAbsencesForDate(selectedDate);
  }, [selectedDate, requests]);

  // Generate quick aggregated statistics for the current view month
  const activeMonthStats = useMemo(() => {
    const approvedAbsencesSet = new Set<string>();
    const pendingAbsencesSet = new Set<string>();
    let totalApprovedDays = 0;

    requests.forEach(req => {
      const start = parseLocalDate(req.startDate);
      const end = parseLocalDate(req.endDate);
      
      // Check if request overlaps with current month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);

      if (start <= endOfMonth && end >= startOfMonth) {
        if (req.status === 'approved') {
          approvedAbsencesSet.add(req.username);
          // calculate overlap days
          const overlapStart = start < startOfMonth ? startOfMonth : start;
          const overlapEnd = end > endOfMonth ? endOfMonth : end;
          const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          totalApprovedDays += diffDays;
        } else if (req.status === 'pending') {
          pendingAbsencesSet.add(req.username);
        }
      }
    });

    return {
      uniqueApprovedUsers: approvedAbsencesSet.size,
      uniquePendingUsers: pendingAbsencesSet.size,
      totalApprovedDays,
    };
  }, [requests, year, month]);

  const monthName = currentMonth.toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-5 animate-fade-in text-left" id="time-off-calendar-root">
      
      {/* Month statistics banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-card-bg border border-main-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-muted-text uppercase tracking-wider font-mono font-bold">Month Off-Duty Days</span>
            <div className="text-base font-extrabold text-main-text leading-tight">{activeMonthStats.totalApprovedDays} Approved Days</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-muted-text uppercase tracking-wider font-mono font-bold">Active Absences</span>
            <div className="text-base font-extrabold text-main-text leading-tight">{activeMonthStats.uniqueApprovedUsers} Team Member(s)</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-muted-text uppercase tracking-wider font-mono font-bold">Awaiting Action</span>
            <div className="text-base font-extrabold text-main-text leading-tight">{activeMonthStats.uniquePendingUsers} Pending Review</div>
          </div>
        </div>
      </div>

      {/* Main Calendar Section */}
      <div className="bg-card-bg border border-main-border rounded-2xl p-5 shadow-lg space-y-4">
        {/* Calendar Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-main-border/30 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div>
              <h4 className="text-sm font-extrabold text-main-text uppercase tracking-tight">{monthName} {year}</h4>
              <p className="text-[10px] text-muted-text font-mono">Interactive Team Off-Duty Matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl border border-main-border bg-app-bg hover:bg-main-border/35 text-muted-text hover:text-main-text cursor-pointer transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleGoToToday}
              className="px-3 py-1.5 rounded-xl border border-main-border bg-app-bg hover:bg-main-border/35 text-xs font-bold text-main-text cursor-pointer transition-colors"
            >
              Current (Jun 2026)
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl border border-main-border bg-app-bg hover:bg-main-border/35 text-muted-text hover:text-main-text cursor-pointer transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Calendar Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-muted-text">
          <span className="font-semibold text-main-text uppercase tracking-wider">Status Key:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending Review
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Denied
          </span>
        </div>

        {/* Month Day-Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Weekday Labels */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div 
              key={day} 
              className="text-center text-[10px] font-bold text-muted-text uppercase tracking-widest py-1.5 font-mono"
            >
              {day}
            </div>
          ))}

          {/* Day Grid Cells */}
          {calendarDays.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === month;
            const absences = getAbsencesForDate(date);
            const isSelected = selectedDate && 
              date.getFullYear() === selectedDate.getFullYear() &&
              date.getMonth() === selectedDate.getMonth() &&
              date.getDate() === selectedDate.getDate();
            
            const isToday = date.getFullYear() === 2026 && date.getMonth() === 5 && date.getDate() === 30;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`min-h-[72px] sm:min-h-[84px] text-left p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  isCurrentMonth ? 'bg-app-bg/45' : 'bg-app-bg/10 opacity-35'
                } ${
                  isSelected 
                    ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/[0.03]' 
                    : isToday 
                    ? 'border-amber-500/50' 
                    : 'border-main-border hover:border-main-border/80'
                }`}
              >
                {/* Day Header Info */}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[10px] font-mono font-bold ${
                    isToday 
                      ? 'bg-amber-500 text-black px-1.5 py-0.2 rounded font-extrabold' 
                      : isSelected 
                      ? 'text-blue-500 font-extrabold' 
                      : 'text-main-text'
                  }`}>
                    {date.getDate()}
                  </span>
                  
                  {absences.length > 0 && (
                    <span className="text-[8px] font-mono font-black px-1 bg-main-border/40 text-muted-text rounded">
                      {absences.length}
                    </span>
                  )}
                </div>

                {/* Absences visualization badges */}
                <div className="flex-1 w-full mt-1.5 space-y-1 overflow-hidden flex flex-col justify-end">
                  {absences.slice(0, 3).map((abs) => {
                    const statusColor = 
                      abs.status === 'approved' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : abs.status === 'denied' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                    return (
                      <div 
                        key={abs.id} 
                        className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded border leading-none font-bold truncate ${statusColor}`}
                        title={`${abs.fullName}: ${abs.reason}`}
                      >
                        {abs.fullName.split(' ')[0]}
                      </div>
                    );
                  })}
                  {absences.length > 3 && (
                    <div className="text-[8px] text-muted-text font-mono font-bold pl-1">
                      +{absences.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Absentee Pane */}
      {selectedDate && (
        <div className="bg-card-bg border border-main-border rounded-2xl p-5 shadow-lg space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-main-border/30 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-blue-500" />
              <h5 className="text-xs font-bold text-main-text">
                Absences on {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h5>
            </div>
            <span className="text-[10px] font-mono text-muted-text bg-app-bg border border-main-border px-2.5 py-1 rounded-lg">
              {selectedDateRequests.length} employee(s) out
            </span>
          </div>

          {selectedDateRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedDateRequests.map((req) => {
                const isApproved = req.status === 'approved';
                const isDenied = req.status === 'denied';

                return (
                  <div 
                    key={req.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between text-left space-y-2.5 bg-app-bg/35 ${
                      isApproved 
                        ? 'border-emerald-500/20 bg-emerald-500/[0.01]' 
                        : isDenied 
                        ? 'border-red-500/20 bg-red-500/[0.01]' 
                        : 'border-amber-500/20 bg-amber-500/[0.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h6 className="text-xs font-extrabold text-main-text leading-tight">{req.fullName}</h6>
                        <span className="text-[9px] text-muted-text font-mono">@{req.username}</span>
                      </div>
                      
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-extrabold text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                          Approved
                        </span>
                      ) : isDenied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[8px] font-extrabold text-red-500 border border-red-500/20 uppercase tracking-widest">
                          Denied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-extrabold text-amber-500 border border-amber-500/20 uppercase tracking-widest animate-pulse">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[9px] font-mono text-muted-text uppercase font-bold">Span Dates</div>
                      <p className="text-xs font-semibold text-main-text">
                        {new Date(req.startDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                        {" – "}
                        {new Date(req.endDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[9px] font-mono text-muted-text uppercase font-bold">Memo / Reason</div>
                      <p className="text-xs text-main-text italic leading-relaxed">
                        "{req.reason}"
                      </p>
                    </div>

                    {req.managerNotes && (
                      <div className="bg-blue-500/[0.02] border border-blue-500/10 rounded-lg p-2 text-left">
                        <span className="text-[8px] font-mono text-blue-500 font-bold block uppercase">Admin Note</span>
                        <p className="text-[11px] text-muted-text italic">"{req.managerNotes}"</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-text bg-app-bg/20 border border-dashed border-main-border/60 rounded-xl space-y-1">
              <UserMinus className="h-6 w-6 text-muted-text/30 mx-auto" />
              <p className="text-xs font-bold text-muted-text">Fully Staffed</p>
              <p className="text-[10px] text-muted-text/70">No employee absences are scheduled for this day.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
