import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, CheckCircle2, ShieldCheck, Camera } from 'lucide-react';
import { getActiveSessions, startOneTapTimer, stopOneTapTimer, updateActiveSessionFlha, ActiveSession, UserAccount } from '../utils/storage';
import { compressImageToDataUrl } from '../utils/imageCompressor';

interface HeaderTimerProps {
  currentUser: UserAccount | null;
  onShiftLogged?: () => void;
  isMobileView?: boolean;
}

export const HeaderTimer: React.FC<HeaderTimerProps> = ({ currentUser, onShiftLogged }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadingFlha, setIsUploadingFlha] = useState(false);
  const flhaInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleHeaderFlhaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    try {
      setIsUploadingFlha(true);
      const dataUrl = await compressImageToDataUrl(file, 1200, 1200, 0.82);
      const nowIso = new Date().toISOString();
      updateActiveSessionFlha(dataUrl, nowIso, activeSession?.location || 'General Site');
      syncSession();
      setToastMessage('FLHA Attached & Synced to Manager');
    } catch (err) {
      console.error('Header FLHA upload error:', err);
      setToastMessage('Failed to attach FLHA');
    } finally {
      setIsUploadingFlha(false);
      e.target.value = '';
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
      <input
        ref={flhaInputRef}
        type="file"
        accept="image/*"
        onChange={handleHeaderFlhaSelect}
        className="hidden"
      />
      {activeSession?.isClockedIn ? (
        // Active Running State: live timer + FLHA button + 1-tap stop button
        <div
          id="header-active-timer-pill"
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 min-h-[44px] rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-main-text shadow-sm shrink-0"
          title={`Active Shift: Started at ${activeSession.startTime || 'now'}`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatTimer(secondsElapsed)}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeSession.flhaImageUrl) {
                window.dispatchEvent(new CustomEvent('workspace-view-active-flha'));
              } else {
                flhaInputRef.current?.click();
              }
            }}
            disabled={isUploadingFlha}
            className={`flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1 min-h-[34px] rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 border ${
              activeSession.flhaImageUrl
                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/15 text-amber-500 border-amber-500/35 hover:bg-amber-500/25'
            }`}
            title={
              activeSession.flhaImageUrl
                ? 'FLHA Attached (Click to View or Replace)'
                : 'Attach FLHA Safety Card to Active Shift'
            }
          >
            {activeSession.flhaImageUrl ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Camera className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="hidden md:inline">
              {isUploadingFlha ? '...' : activeSession.flhaImageUrl ? 'FLHA ✓' : '+FLHA'}
            </span>
          </button>

          <button
            id="header-stop-timer-btn"
            onClick={handleStop}
            className="flex items-center justify-center gap-1 ml-0.5 px-2 sm:px-2.5 py-1.5 min-h-[34px] rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
            title="Stop Timer & Save Shift"
          >
            <Square className="h-2.5 w-2.5 fill-current shrink-0" />
            <span className="hidden sm:inline">Stop</span>
          </button>
        </div>
      ) : (
        // Idle State: 1-tap Start Timer button (On < 640px screens, hide text and show only play icon)
        <button
          id="header-start-timer-btn"
          onClick={handleStart}
          className="min-h-[44px] min-w-[40px] flex items-center justify-center gap-1.5 cursor-pointer font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-sm transition-all duration-200 active:scale-95 px-2.5 sm:px-3 py-2 rounded-xl text-xs shrink-0"
          title="Start Shift Timer (1-tap, no task required)"
          aria-label="Start Timer"
        >
          <Play className="h-3.5 w-3.5 fill-current shrink-0" />
          <span className="hidden sm:inline">Start Timer</span>
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
