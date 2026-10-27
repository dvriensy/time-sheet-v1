/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, 
  Unlink, ShieldCheck, HelpCircle, WifiOff, Lock, Eye, 
  ChevronDown, ArrowRight, X, Clock, Layers
} from 'lucide-react';
import { 
  connectGoogleCalendar, 
  disconnectGoogleCalendar, 
  subscribeCalendarState, 
  clearCalendarError,
  testCalendarConnection,
  syncShiftsToGoogleCalendar,
  setSelectedCalendarId,
  CalendarConnectionState,
  CalendarErrorDetails,
  getCalendarAccessToken
} from '../services/googleCalendar';
import { FutureShift } from '../types';
import { TimeOffRequest, getFutureShifts, getTimeOffRequests } from '../utils/storage';

interface GoogleCalendarSyncCardProps {
  shifts?: FutureShift[];
  timeOffs?: TimeOffRequest[];
  compact?: boolean;
  onSyncComplete?: () => void;
}

export default function GoogleCalendarSyncCard({
  shifts,
  timeOffs,
  compact = false,
  onSyncComplete
}: GoogleCalendarSyncCardProps) {
  const [calendarState, setCalendarState] = useState<CalendarConnectionState>({
    isConnected: false,
    isConnecting: false,
    isSyncing: false,
    userEmail: null,
    userName: null,
    userPhoto: null,
    lastSyncTime: null,
    selectedCalendarId: 'primary',
    availableCalendars: [],
    error: null
  });

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showPopupGuide, setShowPopupGuide] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [isEmbeddedIframe] = useState(() => typeof window !== 'undefined' && window.self !== window.top);

  // Subscribe to live calendar auth state changes
  useEffect(() => {
    const unsubscribe = subscribeCalendarState((nextState) => {
      setCalendarState(nextState);
    });
    return unsubscribe;
  }, []);

  // Clear feedback toast after 5 seconds
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Derived shifts & time-offs to sync
  const localShifts = shifts || getFutureShifts();
  const localTimeOffs = timeOffs || getTimeOffRequests();
  const syncableCount = localShifts.length + localTimeOffs.filter(t => t.status === 'approved').length;

  const handleConnect = async () => {
    setFeedbackToast(null);
    const result = await connectGoogleCalendar();
    if (result.success) {
      setFeedbackToast({
        type: 'success',
        message: 'Google Calendar successfully connected! You can now sync shifts.'
      });
    }
  };

  const handleDisconnect = async () => {
    setShowDisconnectModal(false);
    await disconnectGoogleCalendar();
    setFeedbackToast({
      type: 'info',
      message: 'Google Calendar has been disconnected.'
    });
  };

  const handleTestConnection = async () => {
    setFeedbackToast(null);
    const res = await testCalendarConnection();
    if (res.success) {
      setFeedbackToast({
        type: 'success',
        message: res.message
      });
    } else {
      setFeedbackToast({
        type: 'error',
        message: res.message
      });
    }
  };

  const handleSyncNow = async () => {
    setFeedbackToast(null);
    const res = await syncShiftsToGoogleCalendar(localShifts, localTimeOffs);
    if (res.success) {
      setFeedbackToast({
        type: 'success',
        message: `Successfully synced ${res.results.synced} events to your Google Calendar!`
      });
      if (onSyncComplete) onSyncComplete();
    } else if (res.results.synced > 0) {
      setFeedbackToast({
        type: 'info',
        message: `Partial sync: ${res.results.synced} succeeded, ${res.results.failed} failed.`
      });
    }
  };

  const formatLastSync = (isoStr: string | null) => {
    if (!isoStr) return 'Never synced';
    try {
      const date = new Date(isoStr);
      return `Synced ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recently';
    }
  };

  const tokenActive = !!getCalendarAccessToken();

  return (
    <div className="rounded-3xl border border-main-border bg-card-bg p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-200">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-main-border relative">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-main-text">Google Calendar Sync</h3>
              {calendarState.isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
                  Not Linked
                </span>
              )}
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              Sync scheduled shifts, overtime hours, and approved time-off to your calendar.
            </p>
          </div>
        </div>

        {/* Top-right quick actions */}
        {calendarState.isConnected && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleTestConnection}
              disabled={calendarState.isConnecting || calendarState.isSyncing}
              className="px-2.5 py-1.5 rounded-xl border border-main-border hover:bg-main-border/30 text-[11px] font-mono text-muted-text hover:text-main-text transition cursor-pointer flex items-center gap-1.5"
              title="Verify Google API connection credentials"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Test Access</span>
            </button>
            <button
              onClick={() => setShowDisconnectModal(true)}
              disabled={calendarState.isConnecting || calendarState.isSyncing}
              className="px-2.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-[11px] font-mono text-rose-400 transition cursor-pointer flex items-center gap-1.5"
              title="Disconnect Google account"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Unlink</span>
            </button>
          </div>
        )}
      </div>

      {/* Embedded Iframe Notification */}
      {isEmbeddedIframe && !calendarState.isConnected && (
        <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <HelpCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-200">Running in Embedded Preview</p>
            <p className="text-[11px] text-amber-300/90 mt-0.5">
              Google Sign-In uses a secure authentication popup. If your browser blocks popups in this frame, open the app in a new window or allow popups in your address bar.
            </p>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className={`mt-4 p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
              feedbackToast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : feedbackToast.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackToast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
              {feedbackToast.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />}
              {feedbackToast.type === 'info' && <ShieldCheck className="h-4 w-4 shrink-0 text-blue-400" />}
              <span>{feedbackToast.message}</span>
            </div>
            <button 
              onClick={() => setFeedbackToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-muted-text hover:text-main-text transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE ERROR BANNER WITH ACTIONABLE DIAGNOSTICS */}
      <AnimatePresence>
        {calendarState.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.98, height: 0 }}
            className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-left space-y-3 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400 shrink-0 mt-0.5">
                  {calendarState.error.code === 'NETWORK_ERROR' ? (
                    <WifiOff className="h-4 w-4" />
                  ) : calendarState.error.code === 'POPUP_BLOCKED' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-rose-300">
                      {calendarState.error.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-mono uppercase font-bold tracking-wider bg-rose-500/20 text-rose-200 border border-rose-500/30">
                      {calendarState.error.code}
                    </span>
                  </div>
                  <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                    {calendarState.error.message}
                  </p>
                </div>
              </div>
              <button
                onClick={clearCalendarError}
                className="p-1 text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition cursor-pointer shrink-0"
                title="Dismiss Error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actionable Resolution Hint */}
            <div className="bg-rose-950/40 rounded-xl p-3 border border-rose-500/20 text-xs text-rose-200">
              <p className="font-semibold text-rose-100 flex items-center gap-1.5 mb-1">
                <span>💡 Recommended Solution:</span>
              </p>
              <p className="text-[11px] text-rose-200/90 leading-normal">
                {calendarState.error.actionHint}
              </p>

              {/* Popup guide toggle */}
              {calendarState.error.popupBlockedHelp && (
                <div className="mt-2.5 pt-2 border-t border-rose-500/20">
                  <button
                    onClick={() => setShowPopupGuide(!showPopupGuide)}
                    className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showPopupGuide ? 'Hide instructions' : 'How to unblock popups in Chrome / Safari / Edge'}</span>
                  </button>
                  
                  {showPopupGuide && (
                    <div className="mt-2 text-[11px] text-slate-300 space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-slate-700 font-mono">
                      <p>1. Look at the right side of your browser URL address bar.</p>
                      <p>2. Find the blocked popup icon (looks like a window with a red X).</p>
                      <p>3. Click it and select <strong className="text-white">Always allow pop-ups and redirects</strong>.</p>
                      <p>4. Click Done, then click the <strong className="text-white">Try Again</strong> button below.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Actions Row */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                {calendarState.error.isRetryable && (
                  <button
                    onClick={handleConnect}
                    disabled={calendarState.isConnecting}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3 w-3 ${calendarState.isConnecting ? 'animate-spin' : ''}`} />
                    <span>Try Again</span>
                  </button>
                )}
                <button
                  onClick={clearCalendarError}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              {/* Technical detail toggle */}
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-[10px] font-mono text-rose-300/70 hover:text-rose-200 transition cursor-pointer flex items-center gap-1"
              >
                <span>{showTechnicalDetails ? 'Hide Details' : 'Show Details'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Technical diagnostic details drawer */}
            {showTechnicalDetails && (
              <div className="mt-2 p-2.5 rounded-lg bg-black/60 border border-rose-500/20 font-mono text-[10px] text-rose-300/80 space-y-1 select-all break-all">
                <p><span className="text-slate-400">Error Code:</span> {calendarState.error.rawCode || calendarState.error.code}</p>
                <p><span className="text-slate-400">Raw Message:</span> {calendarState.error.rawError || calendarState.error.message}</p>
                <p><span className="text-slate-400">Timestamp:</span> {new Date().toISOString()}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Body */}
      <div className="mt-5 space-y-4">
        {calendarState.isConnected ? (
          /* CONNECTED STATE */
          <div className="space-y-4">
            {/* User Profile Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-input-bg border border-main-border">
              <div className="flex items-center gap-3">
                {calendarState.userPhoto ? (
                  <img 
                    src={calendarState.userPhoto} 
                    alt={calendarState.userName || 'Google Account'} 
                    className="h-10 w-10 rounded-xl object-cover border border-main-border shadow-sm"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {calendarState.userName ? calendarState.userName.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-semibold text-main-text">
                    {calendarState.userName || 'Google Calendar Account'}
                  </p>
                  <p className="text-[11px] font-mono text-muted-text">
                    {calendarState.userEmail || 'Connected'}
                  </p>
                </div>
              </div>

              {/* Status & Last Synced */}
              <div className="text-left sm:text-right text-[11px] text-muted-text font-mono">
                <p className="flex items-center sm:justify-end gap-1.5 text-main-text font-medium">
                  <Clock className="h-3 w-3 text-blue-400" />
                  <span>{formatLastSync(calendarState.lastSyncTime)}</span>
                </p>
                <p className="text-[10px] text-muted-text/70 mt-0.5">
                  {tokenActive ? 'In-Memory Session Active' : 'Session Ready to Refresh'}
                </p>
              </div>
            </div>

            {/* Target Calendar Selector */}
            {calendarState.availableCalendars.length > 1 && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-input-bg border border-main-border">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-muted-text">Target Calendar:</span>
                </div>
                <select
                  value={calendarState.selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  className="rounded-xl border border-main-border bg-card-bg px-3 py-1.5 text-xs text-main-text font-mono focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {calendarState.availableCalendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary} {cal.primary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sync Action Area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
              <div className="text-left">
                <p className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                  <span>Upcoming Items to Sync:</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold font-mono">
                    {syncableCount}
                  </span>
                </p>
                <p className="text-[11px] text-muted-text mt-0.5">
                  Includes {localShifts.length} scheduled shifts and {localTimeOffs.filter(t => t.status === 'approved').length} approved time-off days.
                </p>
              </div>

              <button
                onClick={handleSyncNow}
                disabled={calendarState.isSyncing || calendarState.isConnecting}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${calendarState.isSyncing ? 'animate-spin' : ''}`} />
                <span>{calendarState.isSyncing ? 'Syncing to Google...' : 'Sync Calendar Now'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="space-y-4">
            <div className="rounded-2xl border border-main-border/70 bg-input-bg/40 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-2.5 rounded-xl bg-card-bg border border-main-border/50 space-y-1">
                  <p className="text-xs font-bold text-main-text flex items-center gap-1.5">
                    <span className="text-blue-500">📅</span> Work Shifts
                  </p>
                  <p className="text-[11px] text-muted-text">
                    All upcoming scheduled shifts populate directly into your Google Calendar.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-card-bg border border-main-border/50 space-y-1">
                  <p className="text-xs font-bold text-main-text flex items-center gap-1.5">
                    <span className="text-emerald-500">🏖️</span> Time Off
                  </p>
                  <p className="text-[11px] text-muted-text">
                    Approved absences automatically block off days so you never double-book.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-card-bg border border-main-border/50 space-y-1">
                  <p className="text-xs font-bold text-main-text flex items-center gap-1.5">
                    <span className="text-amber-500">📱</span> Phone & Desktop
                  </p>
                  <p className="text-[11px] text-muted-text">
                    Syncs seamlessly across iOS Calendar, Android, and Google Calendar apps.
                  </p>
                </div>
              </div>
            </div>

            {/* Official Google Sign-in Styled Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-text text-left">
                Securely connects via Google OAuth with permission to manage work calendar events.
              </p>

              <button
                onClick={handleConnect}
                disabled={calendarState.isConnecting}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-3 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs sm:text-sm border border-slate-300 shadow-sm active:scale-[0.98] transition cursor-pointer shrink-0 disabled:opacity-60"
              >
                {calendarState.isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    {/* Google G Logo SVG */}
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Connect Google Calendar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      <AnimatePresence>
        {showDisconnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-main-border bg-card-bg p-5 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <Unlink className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-main-text">Disconnect Google Calendar?</h4>
                  <p className="text-xs text-muted-text mt-0.5">Unlink your Google account from this device</p>
                </div>
              </div>

              <p className="text-xs text-muted-text leading-relaxed">
                Disconnecting will remove the active Google session and stop future shift synchronization until you re-authenticate. Existing events on your calendar will remain untouched.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-main-border hover:bg-main-border/30 text-xs font-medium text-main-text transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/30 transition cursor-pointer"
                >
                  Yes, Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
