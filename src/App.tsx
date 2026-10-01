/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Sun, Moon, Users, CalendarDays, Bell, Share, X } from 'lucide-react';
import { 
  getTimesheets, 
  getAppSettings, 
  getReminderSettings,
  initializeStorage, 
  getCurrentUser, 
  logoutUser, 
  UserAccount,
  getTimeOffRequests,
  initializeFirebaseSync,
  refetchFromFirestore,
  enrichEntriesWithOvertime,
  safeSetItem
} from './utils/storage';
import { 
  registerServiceWorker, 
  startWorkday5pmScheduler,
  getIOSNotificationInfo
} from './utils/pushNotifications';
import { applyDeviceProfileToDocument } from './utils/deviceProfile';
import { TimesheetEntry } from './types';

// Import our modular sub-components
import UserAuthGate from './components/UserAuthGate';
import TimesheetManager from './components/TimesheetManager';
import AccountView from './components/AccountView';
import ManagerView from './components/ManagerView';
import TimeOffSidebar from './components/TimeOffSidebar';
import HeaderTimer from './components/HeaderTimer';
import PhoneSizingModal from './components/PhoneSizingModal';

export default function App() {
  // Initialize standard LocalStorage templates on mount
  useEffect(() => {
    initializeStorage();
    
    // Initialize Firebase Sync
    initializeFirebaseSync(() => {
      setCurrentUser(getCurrentUser());
      handleLoadData();
      updateTimeOffBadgeCount();
    });

    const handleSync = () => {
      setCurrentUser(getCurrentUser());
      handleLoadData();
      updateTimeOffBadgeCount();
    };
    window.addEventListener('storage-sync', handleSync);

    // Refetch helper
    const triggerRefetch = () => {
      refetchFromFirestore(() => {
        setCurrentUser(getCurrentUser());
        handleLoadData();
        updateTimeOffBadgeCount();
      });
    };

    // Window Focus / Tab Visibility Refetch
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        triggerRefetch();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    // Periodic Background Polling (Every 30 Seconds)
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerRefetch();
      }
    }, 30000);

    return () => {
      window.removeEventListener('storage-sync', handleSync);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      clearInterval(pollInterval);
    };
  }, []);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [isMobile, setIsMobile] = useState(false);
  const [isPhoneSizingOpen, setIsPhoneSizingOpen] = useState(false);
  const [showIOSHomeScreenBanner, setShowIOSHomeScreenBanner] = useState(() => {
    const info = getIOSNotificationInfo();
    return info.iosNeedsHomeScreen;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      applyDeviceProfileToDocument();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const handleOpenPhoneSizing = () => setIsPhoneSizingOpen(true);
    window.addEventListener('workspace-open-phone-sizing', handleOpenPhoneSizing);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('workspace-open-phone-sizing', handleOpenPhoneSizing);
    };
  }, []);

  // Web Push Notifications Service Worker & 5:00 PM Workday Shift Reminder Scheduler
  useEffect(() => {
    // 1. Register the Service Worker in public/sw.js
    registerServiceWorker();

    // 2. Start client-side 5:00 PM workday check
    const stopScheduler = startWorkday5pmScheduler(
      () => {
        const settings = getReminderSettings();
        return settings.dailyShiftReminder ?? true;
      },
      currentUser?.username
    );

    // 3. Handle push notification click navigation (opens shift logger directly)
    const handleCheckUrlActions = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const tab = params.get('tab');
        if (action === 'log-shift' || tab === 'timesheet' || tab === 'timesheets') {
          setActiveTab('timesheets');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('workspace-open-shift-logger'));
          }, 150);
        }
      } catch (e) {
        console.warn('Error evaluating URL action:', e);
      }
    };

    handleCheckUrlActions();
    window.addEventListener('popstate', handleCheckUrlActions);

    // 4. Handle Service Worker postMessage for foreground tabs
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_SHIFT_LOGGER') {
        setActiveTab('timesheets');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('workspace-open-shift-logger'));
        }, 150);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      stopScheduler();
      window.removeEventListener('popstate', handleCheckUrlActions);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [currentUser?.username]);

  const isManager = !!(currentUser && (currentUser.role === 'manager' || currentUser.username === 'derek_vriens' || currentUser.fullName.toLowerCase() === 'derek vriens' || currentUser.email?.toLowerCase() === 'dvriensy@gmail.com'));
  const [activeTab, setActiveTab] = useState<'timesheets' | 'account' | 'manager'>('timesheets');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('timesheets_tracker_theme') as 'light' | 'dark') || 'dark';
  });

  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [timeOffBadge, setTimeOffBadge] = useState(0);

  const updateTimeOffBadgeCount = () => {
    if (!currentUser) {
      setTimeOffBadge(0);
      return;
    }
    const allReqs = getTimeOffRequests();
    if (isManager) {
      const pendingCount = allReqs.filter(r => r.status === 'pending').length;
      setTimeOffBadge(pendingCount);
    } else {
      const unacknowledgedCount = allReqs.filter(r => r.username === currentUser.username && !r.acknowledgedByRequester && r.status !== 'pending').length;
      setTimeOffBadge(unacknowledgedCount);
    }
  };

  useEffect(() => {
    updateTimeOffBadgeCount();
    const interval = setInterval(updateTimeOffBadgeCount, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Track and apply theme changes to root document
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeSetItem('timesheets_tracker_theme', theme);
  }, [theme]);

  // Core Data source states
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);

  // Fetch active settings and datasets
  const handleLoadData = () => {
    const rawTimesheets = getTimesheets();
    const enriched = enrichEntriesWithOvertime(rawTimesheets);
    setTimesheets(enriched);
    
    const settings = getAppSettings();
    setPrivacyMode(settings.privacyMode);
  };

  useEffect(() => {
    if (currentUser) {
      handleLoadData();
    }
  }, [currentUser]);

  const handleRefreshAll = () => {
    handleLoadData();
  };

  const handleTogglePrivacy = () => {
    const nextPrivacy = !privacyMode;
    setPrivacyMode(nextPrivacy);
    // Update local preferences
    const settings = getAppSettings();
    settings.privacyMode = nextPrivacy;
    safeSetItem('timesheets_tracker_app_settings', JSON.stringify(settings));
  };

  const renderAppContent = (isMobileView = false) => {
    if (!currentUser) {
      return (
        <UserAuthGate 
          onAuthSuccess={(user) => {
            setCurrentUser(user);
          }} 
          isMobileView={isMobileView}
        />
      );
    }

    return (
      <div className="flex-grow flex flex-col w-full max-w-full h-full relative overflow-hidden min-h-0">
        {/* Top bar header */}
        <header className="flex flex-row items-center justify-between gap-2 px-2.5 py-2 sm:px-3.5 sm:py-2.5 md:px-5 md:py-3 mb-2.5 sm:mb-3 md:mb-4 bg-card-bg rounded-2xl border border-main-border/60 shadow-sm transition-all duration-200 shrink-0 select-none w-full max-w-full overflow-hidden box-border">
          {/* Logo / Brand & Tabs (Left alignment on desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative group shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 rounded-xl blur-[2px] opacity-40 group-hover:opacity-75 transition duration-300"></div>
                <img 
                  src="/logo.jpg" 
                  alt="WORKSPACE Logo" 
                  className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl object-cover shadow-md shadow-blue-500/20 border border-blue-400/30" 
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-xs sm:text-sm md:text-base font-display font-extrabold tracking-wider text-main-text leading-tight flex items-center truncate">
                  <span className="tracking-wide">WORK</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 font-black">SPACE</span>
                </h1>
                {!isMobileView && (
                  <div className="hidden xl:flex items-center gap-1.5 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-blue-500 dark:text-sky-400 font-medium">Enterprise Suite</p>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Navigation Tabs (Directly in header next to logo) */}
            {!isMobileView && (
              <div className="flex items-center bg-app-bg p-1 rounded-xl border border-main-border/50 shrink-0">
                <button
                  onClick={() => setActiveTab('timesheets')}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === 'timesheets' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-muted-text hover:text-main-text'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Ledger</span>
                </button>
                {isManager && (
                  <button
                    onClick={() => setActiveTab('manager')}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      activeTab === 'manager' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-muted-text hover:text-main-text'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Management</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === 'account' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-muted-text hover:text-main-text'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Utilities (Right alignment) */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
            {/* One-Tap Header Shift Timer */}
            <HeaderTimer 
              currentUser={currentUser}
              onShiftLogged={handleRefreshAll}
              isMobileView={isMobileView}
            />

            {/* Request Time Off Button */}
            <button
              onClick={() => setIsTimeOffOpen(true)}
              className="flex items-center justify-center gap-1.5 cursor-pointer relative border border-blue-500/20 bg-blue-500/5 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-blue-500 shadow-xs transition-all duration-200 h-9 sm:h-10 w-9 sm:w-auto sm:px-2.5 xl:px-3 text-xs rounded-xl font-medium shrink-0"
              title="Request Absence or Time Off"
              aria-label="Request Absence or Time Off"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">Time Off</span>
              {timeOffBadge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-card-bg shadow animate-bounce">
                  {timeOffBadge}
                </span>
              )}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl border border-main-border bg-app-bg text-muted-text hover:text-main-text transition duration-200 cursor-pointer flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 shrink-0"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="h-4 w-4 text-blue-600 hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Profile Avatar & Info */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-main-border/50 pl-1.5 sm:pl-2.5 shrink-0">
              {!isMobileView && (
                <div className="text-right hidden 2xl:block max-w-[110px]">
                  <p className="text-xs font-bold text-main-text leading-tight truncate">{currentUser.fullName}</p>
                  <p className="text-[9px] text-muted-text font-mono truncate">@{currentUser.username}</p>
                </div>
              )}
              <button
                onClick={() => setActiveTab('account')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-app-bg border border-main-border hover:border-blue-500 flex items-center justify-center text-muted-text shrink-0 overflow-hidden cursor-pointer transition-all duration-200 focus:outline-none" 
                title={`${currentUser.fullName} (@${currentUser.username})`}
                aria-label="User Account"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.fullName} referrerPolicy="no-referrer" className="w-full h-full object-cover select-none animate-fade-in" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </button>
              
              {!isMobileView && (
                <button
                  onClick={() => {
                    logoutUser();
                    setCurrentUser(null);
                    setActiveTab('timesheets');
                  }}
                  className="hidden sm:flex items-center justify-center text-xs font-semibold cursor-pointer transition shrink-0 h-9 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-500 px-2.5 rounded-xl"
                  title="Log Out"
                >
                  Log Out
                </button>
              )}
            </div>
          </div>
        </header>

        {/* iOS Safari Add to Home Screen Notification Setup Banner */}
        {showIOSHomeScreenBanner && (
          <div className="mb-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Share className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-main-text leading-snug">
                <strong>iOS Safari Notifications:</strong> Save this app to your Home Screen (tap <strong>Share → Add to Home Screen</strong>) to enable push notifications.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSHomeScreenBanner(false)}
              className="p-1 rounded-lg text-muted-text hover:text-main-text cursor-pointer shrink-0"
              aria-label="Dismiss iOS setup banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* MOBILE NAVIGATION TABS (Equal-Width Grid Segmented Control on mobile) */}
        {isMobileView && (
          <nav 
            aria-label="Mobile Navigation"
            className={`grid ${isManager ? 'grid-cols-3' : 'grid-cols-2'} gap-1 bg-card-bg p-1 rounded-xl border border-main-border/60 mb-2 shrink-0 shadow-sm w-full`}
          >
            <button
              onClick={() => setActiveTab('timesheets')}
              className={`w-full flex items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'timesheets' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-muted-text hover:text-main-text hover:bg-card-bg/50'
              }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Ledger</span>
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab('manager')}
                className={`w-full flex items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === 'manager' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-muted-text hover:text-main-text hover:bg-card-bg/50'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Management</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'account' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-muted-text hover:text-main-text hover:bg-card-bg/50'
              }`}
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Account</span>
            </button>
          </nav>
        )}

        {/* ACTIVE TAB RENDER BLOCK */}
        <main className="flex-grow overflow-hidden min-h-0 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'timesheets' ? (
              <motion.div
                key="timesheets-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="h-full w-full flex flex-col overflow-hidden"
              >
                <TimesheetManager 
                  entries={timesheets} 
                  onRefreshEntries={handleRefreshAll}
                  privacyMode={privacyMode}
                  isMobileView={isMobileView}
                />
              </motion.div>
            ) : activeTab === 'manager' && isManager ? (
              <motion.div
                key="manager-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="h-full w-full flex flex-col overflow-hidden"
              >
                <ManagerView 
                  currentUser={currentUser}
                  isMobileView={isMobileView}
                  onLoginAsUser={(user) => {
                    safeSetItem('timesheets_tracker_current_user', user.username);
                    setCurrentUser(user);
                    setActiveTab('timesheets');
                    handleRefreshAll();
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="account-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="h-full w-full flex flex-col overflow-hidden"
              >
                <AccountView
                  currentUser={currentUser}
                  onUpdateUser={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    handleRefreshAll();
                  }}
                  onLogout={() => {
                    logoutUser();
                    setCurrentUser(null);
                    setActiveTab('timesheets');
                  }}
                  isMobileView={isMobileView}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Modular Right Sidebar Drawer for Time Off Requests */}
        <TimeOffSidebar 
          currentUser={currentUser}
          isOpen={isTimeOffOpen}
          onClose={() => setIsTimeOffOpen(false)}
          onNewRequestSubmitted={() => {
            updateTimeOffBadgeCount();
          }}
        />

        {/* Phone & App Display Sizing Modal */}
        <PhoneSizingModal
          isOpen={isPhoneSizingOpen}
          onClose={() => setIsPhoneSizingOpen(false)}
        />

        {/* Footer info line (hidden on mobile app viewports to maximize vertical space) */}
        <footer className="hidden md:block mt-2 shrink-0 border-t border-main-border/30 py-2 text-center text-[9px] text-muted-text font-mono tracking-wider uppercase select-none">
          WORKSPACE Enterprise Tracker
        </footer>
      </div>
    );
  };

  return (
    <div className="h-dvh min-h-dvh max-h-dvh overflow-hidden bg-app-bg text-main-text flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 pt-safe pb-safe pl-safe pr-safe">
      {/* Decorative radial lighting nodes */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-blue-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* MAIN SYSTEM CONTAINER SHELL */}
      <div className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 h-full overflow-hidden min-h-0">
        {renderAppContent(isMobile)}
      </div>
    </div>
  );
}
