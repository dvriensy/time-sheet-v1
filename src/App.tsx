/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Sun, Moon, Users, CalendarDays, Bell } from 'lucide-react';
import { 
  getTimesheets, 
  getAppSettings, 
  initializeStorage, 
  getCurrentUser, 
  logoutUser, 
  UserAccount,
  getTimeOffRequests,
  initializeFirebaseSync,
  enrichEntriesWithOvertime
} from './utils/storage';
import { TimesheetEntry } from './types';

// Import our modular sub-components
import UserAuthGate from './components/UserAuthGate';
import TimesheetManager from './components/TimesheetManager';
import AccountView from './components/AccountView';
import ManagerView from './components/ManagerView';
import TimeOffSidebar from './components/TimeOffSidebar';

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
    return () => {
      window.removeEventListener('storage-sync', handleSync);
    };
  }, []);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    localStorage.setItem('timesheets_tracker_theme', theme);
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
    localStorage.setItem('timesheets_tracker_app_settings', JSON.stringify(settings));
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
      <div className="flex-grow flex flex-col w-full h-full relative overflow-hidden min-h-0">
        {/* Top bar header */}
        <header className="flex flex-row items-center justify-between p-3 md:px-6 md:py-3.5 mb-3 md:mb-4 bg-card-bg rounded-2xl border border-main-border/60 shadow-sm transition-all duration-200 shrink-0 select-none">
          {/* Logo / Brand & Tabs (Left alignment on desktop) */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/10 w-9 h-9">
                <Clock className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-display font-bold tracking-tight text-main-text leading-none">TIME<span className="text-blue-500 font-normal">LEDGER</span></h1>
                {!isMobileView && <p className="text-[9px] font-mono tracking-wider uppercase text-muted-text/85 mt-0.5">Enterprise Clock</p>}
              </div>
            </div>

            {/* Desktop Navigation Tabs (Directly in header next to logo) */}
            {!isMobileView && (
              <div className="flex items-center bg-app-bg p-1 rounded-xl border border-main-border/50 ml-1 shrink-0">
                <button
                  onClick={() => setActiveTab('timesheets')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
          <div className="flex items-center gap-2 md:gap-3">
            {/* Request Time Off Button */}
            <button
              onClick={() => setIsTimeOffOpen(true)}
              className={`flex items-center gap-1.5 cursor-pointer relative border border-blue-500/20 bg-blue-500/5 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-blue-500 shadow-sm transition-all duration-200 ${
                isMobileView ? 'p-2 rounded-xl' : 'px-3.5 py-1.5 text-xs rounded-xl font-medium'
              }`}
              title="Request Absence or Time Off"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {!isMobileView && <span>Time Off</span>}
              {timeOffBadge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-card-bg shadow animate-bounce">
                  {timeOffBadge}
                </span>
              )}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-main-border bg-app-bg text-muted-text hover:text-main-text transition duration-200 cursor-pointer flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Status light (Desktop Only) */}
            {!isMobileView && (
              <div className="hidden xl:flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-extrabold text-emerald-500 tracking-wide uppercase font-mono">Secured</span>
              </div>
            )}

            {/* Profile Avatar & Info */}
            <div className={`flex items-center gap-2 ${!isMobileView ? 'border-l border-main-border pl-3 md:pl-4' : ''}`}>
              {!isMobileView && (
                <div className="text-right hidden md:block max-w-[100px] lg:max-w-[120px]">
                  <p className="text-xs font-bold text-main-text leading-tight truncate">{currentUser.fullName}</p>
                  <p className="text-[9px] text-muted-text font-mono truncate">@{currentUser.username}</p>
                </div>
              )}
              <button
                onClick={() => setActiveTab('account')}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-app-bg border border-main-border hover:border-blue-500 flex items-center justify-center text-muted-text shrink-0 overflow-hidden cursor-pointer transition-all duration-200 focus:outline-none" 
                title={`${currentUser.fullName} (@${currentUser.username})`}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.fullName} referrerPolicy="no-referrer" className="w-full h-full object-cover select-none animate-fade-in" />
                ) : (
                  <User className="h-4.5 w-4.5" />
                )}
              </button>
              
              <button
                onClick={() => {
                  logoutUser();
                  setCurrentUser(null);
                  setActiveTab('timesheets');
                }}
                className={`text-xs font-semibold cursor-pointer transition shrink-0 ${isMobileView ? 'text-rose-400 hover:text-rose-300 p-1 bg-transparent border-none ml-0.5' : 'bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-500 px-2.5 py-1.5 rounded-xl ml-1.5'}`}
              >
                {isMobileView ? 'Exit' : 'Log Out'}
              </button>
            </div>
          </div>
        </header>

        {/* MOBILE NAVIGATION TABS (Segmented Control below header on mobile) */}
        {isMobileView && (
          <div className="flex items-center bg-card-bg p-1 rounded-xl border border-main-border/60 mb-3 shrink-0 shadow-sm">
            <button
              onClick={() => setActiveTab('timesheets')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
                    localStorage.setItem('timesheets_tracker_current_user', user.username);
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

        {/* Footer info line */}
        <footer className="mt-2 shrink-0 border-t border-main-border/30 py-2 text-center text-[9px] text-muted-text font-mono tracking-wider uppercase select-none">
          Timesheets Work Tracker
        </footer>
      </div>
    );
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-app-bg text-main-text flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Decorative radial lighting nodes */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-blue-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* MAIN SYSTEM CONTAINER SHELL */}
      <div className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 py-3 md:px-6 md:py-4 h-full overflow-hidden min-h-0">
        {renderAppContent(isMobile)}
      </div>
    </div>
  );
}
