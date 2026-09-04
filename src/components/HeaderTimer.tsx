import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, CheckCircle2 } from 'lucide-react';
import { getActiveSessions, startOneTapTimer, stopOneTapTimer, ActiveSession, UserAccount } from '../utils/storage';

interface HeaderTimerProps {
  currentUser: UserAccount | null;
  onShiftLogged?: () => void;
  isMobileView?: boolean;
}

export const HeaderTimer: React.FC<HeaderTimerProps> = ({ currentUser, onShiftLogged, isMobileView }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const syncSession = useCallback(() => {
    if (!currentUser?.username) {
      setActiveSession(null);
      setSecondsElapsed(0);
      return;
    }
    const all = getActiveSessions();
    const session = all[currentUser.username];
    if (session && session.isClockedIn) {
      setActiveSession(session);
      const now = Date.now();
      const startMs = session.clockInTimestamp || (now - (session.daySecondsElapsed || session.secondsElapsed || 0) * 1000);
      setSecondsElapsed(Math.max(0, Math.floor((now - startMs) / 1000)));
    } else {
      setActiveSession(null);
      setSecondsElapsed(0);
    }
  }, [currentUser?.username]);

  // Initial sync & event listeners
  useEffect(() => {
    syncSession();

    const handleSync = () => syncSession();
    window.addEventListener('storage-sync', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('timer-state-changed', handleSync);

    return () => {
      window.removeEventListener('storage-sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('timer-state-changed', handleSync);
    };
  }, [syncSession]);

  // Tick interval when clocked in
  useEffect(() => {
    if (!activeSession || !activeSession.isClockedIn) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const startMs = activeSession.clockInTimestamp || (now - (activeSession.daySecondsElapsed || activeSession.secondsElapsed || 0) * 1000);
      setSecondsElapsed(Math.max(0, Math.floor((now - startMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const session = startOneTapTimer();
    if (session) {
      setActiveSession(session);
      setToastMessage('Shift Started');
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const entry = stopOneTapTimer();
    setActiveSession(null);
    setSecondsElapsed(0);
    if (entry) {
      setToastMessage(`Shift Saved (${entry.totalHours.toFixed(2)} hrs)`);
      if (onShiftLogged) onShiftLogged();
    }
  };

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

  if (!currentUser) return null;

  return (
    <div className="relative flex items-center shrink-0">
      {activeSession?.isClockedIn ? (
        // Active Running State: live timer + 1-tap stop button
        <div
          id="header-active-timer-pill"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-main-text shadow-sm"
          title={`Active Shift: Started at ${activeSession.startTime || 'now'}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatTimer(secondsElapsed)}
          </span>

          <button
            id="header-stop-timer-btn"
            onClick={handleStop}
            className="flex items-center gap-1 ml-0.5 sm:ml-1 px-2 py-0.5 sm:py-1 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-[10px] sm:text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Stop Timer & Save Shift"
          >
            <Square className="h-2.5 w-2.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      ) : (
        // Idle State: 1-tap Start Timer button
        <button
          id="header-start-timer-btn"
          onClick={handleStart}
          className={`flex items-center gap-1.5 cursor-pointer font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-sm transition-all duration-200 active:scale-95 ${
            isMobileView ? 'px-2.5 py-1.5 rounded-xl text-xs' : 'px-3 py-1.5 rounded-xl text-xs'
          }`}
          title="Start Shift Timer (1-tap, no task required)"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>Start Timer</span>
        </button>
      )}

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="absolute top-full right-0 mt-2 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-card-bg text-main-text text-xs font-medium rounded-xl shadow-xl border border-main-border animate-in fade-in slide-in-from-top-1 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default HeaderTimer;
