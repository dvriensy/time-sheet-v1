import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Sparkles,
  MapPin,
  Clock,
  Briefcase,
  HelpCircle
} from 'lucide-react';
import { FutureShift, GoogleCalendarAuthState } from '../types';
import { 
  fetchGoogleOAuthConfig,
  getStoredGoogleCalendarAuth, 
  setStoredGoogleCalendarAuth, 
  disconnectGoogleCalendar, 
  connectGoogleCalendarAccount, 
  syncAllFutureShifts,
  isGoogleTokenValid
} from '../utils/googleCalendar';

interface GoogleCalendarIntegrationCardProps {
  currentUsername?: string;
  shifts: FutureShift[];
  onShiftsUpdated?: () => void;
  compact?: boolean;
}

export const GoogleCalendarIntegrationCard: React.FC<GoogleCalendarIntegrationCardProps> = ({
  currentUsername,
  shifts,
  onShiftsUpdated,
  compact = false
}) => {
  const [authState, setAuthState] = useState<GoogleCalendarAuthState>(() => 
    getStoredGoogleCalendarAuth(currentUsername)
  );
  const [oauthConfig, setOAuthConfig] = useState<{ configured: boolean; clientId: string; message?: string }>({
    configured: false,
    clientId: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customClientId, setCustomClientId] = useState('');
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  // Load server OAuth configuration
  useEffect(() => {
    let mounted = true;
    fetchGoogleOAuthConfig().then(cfg => {
      if (mounted) {
        setOAuthConfig(cfg);
        if (!cfg.clientId) {
          // Check if user stored a client id override
          const savedCustom = localStorage.getItem('workspace_custom_google_client_id');
          if (savedCustom) setCustomClientId(savedCustom);
        }
      }
    });

    const handleAuthChange = () => {
      setAuthState(getStoredGoogleCalendarAuth(currentUsername));
    };

    window.addEventListener('google-calendar-auth-changed', handleAuthChange);
    return () => {
      mounted = false;
      window.removeEventListener('google-calendar-auth-changed', handleAuthChange);
    };
  }, [currentUsername]);

  const activeClientId = oauthConfig.clientId || customClientId;
  const isConnected = authState.isConnected && isGoogleTokenValid(authState);

  const handleConnect = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetClientId = (activeClientId || customClientId).trim();

    if (!targetClientId) {
      setShowConfigHelp(true);
      setErrorMessage('Google OAuth Client ID is required. Please provide a Client ID or set GOOGLE_CLIENT_ID.');
      return;
    }

    setIsConnecting(true);
    try {
      if (customClientId) {
        localStorage.setItem('workspace_custom_google_client_id', customClientId.trim());
      }
      const newAuth = await connectGoogleCalendarAccount(targetClientId);
      setStoredGoogleCalendarAuth(newAuth, currentUsername);
      setAuthState(newAuth);
      setSuccessMessage(`Connected to Google Calendar as ${newAuth.email || 'primary'}`);
      
      // Auto-sync existing shifts immediately upon connection if autoSync is enabled
      if (newAuth.autoSyncShifts && shifts.length > 0) {
        setIsSyncing(true);
        const result = await syncAllFutureShifts(shifts, newAuth, currentUsername);
        if (result.successCount > 0) {
          setSuccessMessage(`Connected! Synced ${result.successCount} shift(s) to your Google Calendar.`);
          if (onShiftsUpdated) onShiftsUpdated();
        }
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setErrorMessage(err.message || 'Failed to authenticate with Google');
    } finally {
      setIsConnecting(false);
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleCalendar(currentUsername);
    setAuthState(getStoredGoogleCalendarAuth(currentUsername));
    setSuccessMessage('Disconnected Google Calendar.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSyncNow = async () => {
    if (!isConnected) {
      handleConnect();
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSyncing(true);

    try {
      const result = await syncAllFutureShifts(shifts, authState, currentUsername);
      if (result.failedCount > 0) {
        setErrorMessage(`Synced ${result.successCount} shift(s), but ${result.failedCount} had errors.`);
      } else {
        setSuccessMessage(`Successfully synced ${result.successCount} shift(s) to your Google Calendar!`);
      }
      if (onShiftsUpdated) onShiftsUpdated();
    } catch (err: any) {
      console.error('Sync error:', err);
      setErrorMessage(err.message || 'Failed to sync with Google Calendar');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleToggleAutoSync = () => {
    const updated = {
      ...authState,
      autoSyncShifts: !authState.autoSyncShifts
    };
    setStoredGoogleCalendarAuth(updated, currentUsername);
    setAuthState(updated);
  };

  return (
    <div className={`rounded-2xl border transition-all ${
      isConnected 
        ? 'border-blue-500/25 bg-blue-500/5 dark:bg-blue-950/10' 
        : 'border-main-border bg-card-bg'
    } p-4 sm:p-5 space-y-3 relative overflow-hidden`}>
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isConnected
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
              : 'bg-input-bg border-main-border text-muted-text'
          }`}>
            <Calendar className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-main-text">Google Calendar Sync</h3>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-text bg-input-bg px-2 py-0.5 rounded-full border border-main-border">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              {isConnected 
                ? `Syncing shifts, tasks & work sites to ${authState.email || 'primary calendar'}`
                : 'Automatically create and update events on your primary Google Calendar'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {isConnected ? (
            <>
              <button
                id="gcal-sync-now-btn"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Sync all scheduled shifts now"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-main-border bg-input-bg hover:bg-card-bg text-muted-text hover:text-main-text text-xs transition cursor-pointer"
                title="Open Google Calendar in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open</span>
              </a>

              <button
                onClick={handleDisconnect}
                className="p-1.5 rounded-xl border border-main-border bg-input-bg hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 text-muted-text transition cursor-pointer"
                title="Disconnect Google Calendar"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              id="gcal-connect-btn"
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>{isConnecting ? 'Authorizing...' : 'Connect Google Calendar'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Connected details / settings row */}
      {isConnected && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-main-border/50 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-muted-text hover:text-main-text">
            <input
              type="checkbox"
              checked={authState.autoSyncShifts}
              onChange={handleToggleAutoSync}
              className="rounded border-main-border bg-input-bg text-blue-600 focus:ring-blue-500/20 h-4 w-4"
            />
            <span>Auto-sync when shifts are scheduled or modified</span>
          </label>

          {authState.lastSyncTime && (
            <span className="text-[11px] text-muted-text font-mono">
              Last synced: {new Date(authState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Missing client id fallback / setup helper */}
      {!isConnected && !activeClientId && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-600 dark:text-amber-300">
              <span className="font-semibold">Google OAuth Client ID needed:</span> Set{' '}
              <code className="bg-black/20 px-1 py-0.5 rounded font-mono text-[11px]">GOOGLE_CLIENT_ID</code> in environment variables or enter it below to authorize.
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 642447499645-...apps.googleusercontent.com"
              value={customClientId}
              onChange={(e) => setCustomClientId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-main-border bg-input-bg text-xs font-mono text-main-text focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleConnect}
              disabled={!customClientId.trim() || isConnecting}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              Authorize
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Features scannable strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-text">
          <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span>Shift Start & End Times</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-text">
          <Briefcase className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span>Active Tasks & Notes</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-text">
          <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span>Site Work Locations</span>
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarIntegrationCard;
