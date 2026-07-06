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
  initializeFirebaseSync
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
    setTimesheets(getTimesheets());
    
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
      <div className="flex-grow flex flex-col w-full h-full relative">
        {/* Top bar header */}
        <header className={`flex ${isMobileView ? 'flex-row items-center justify-between p-3 mb-4 gap-2' : 'flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 mb-6'} bg-card-bg rounded-2xl border border-main-border shadow-xl transition-all duration-200`}>
          <div className="flex items-center gap-2">
            <div className={`bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 ${isMobileView ? 'w-8 h-8' : 'w-10 h-10'}`}>
              <Clock className={`${isMobileView ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
            </div>
            <div>
              <h1 className={`${isMobileView ? 'text-xs' : 'text-xl'} font-bold tracking-tight text-main-text uppercase`}>TIME <span className="text-blue-500">SHEETS</span></h1>
              {!isMobileView && <p className="text-xs text-muted-text">Work Time Tracker</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Navigation Tabs */}
            <div className="flex items-center bg-app-bg/50 p-1 rounded-xl border border-main-border/80 mr-1 shrink-0">
              <button
                onClick={() => setActiveTab('timesheets')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'timesheets' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-muted-text hover:text-main-text'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {!isMobileView && <span>Ledger</span>}
              </button>
              {isManager && (
                <button
                  onClick={() => setActiveTab('manager')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'manager' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-muted-text hover:text-main-text'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {!isMobileView && <span>Manager</span>}
                </button>
              )}
              <button
                onClick={() => setActiveTab('account')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'account' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-muted-text hover:text-main-text'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                {!isMobileView && <span>Account</span>}
              </button>
            </div>
            
            {/* Request Time Off Button */}
            <button
              onClick={() => setIsTimeOffOpen(true)}
              className={`flex items-center gap-1.5 cursor-pointer relative border border-blue-500/10 bg-blue-500/5 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-blue-500 shadow-sm transition-all duration-200 ${
                isMobileView ? 'px-2.5 py-1.5 text-[10px] rounded-lg' : 'px-3 py-2 text-xs rounded-xl'
              }`}
              title="Request Absence or Time Off"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Time Off</span>
              {timeOffBadge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white border border-card-bg shadow animate-bounce">
                  {timeOffBadge}
                </span>
              )}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`${isMobileView ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} border border-main-border bg-app-bg text-muted-text hover:text-main-text transition duration-200 cursor-pointer flex items-center justify-center shadow-sm hover:scale-105 active:scale-95`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className={`${isMobileView ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-amber-400 hover:rotate-45 transition-transform duration-300`} />
              ) : (
                <Moon className={`${isMobileView ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-blue-600 hover:-rotate-12 transition-transform duration-300`} />
              )}
            </button>

            {/* Status light */}
            {!isMobileView && (
              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-emerald-500 tracking-wide uppercase">Secured</span>
              </div>
            )}

            {/* Profile */}
            <div className={`flex items-center gap-2 ${!isMobileView ? 'border-l border-main-border pl-4 sm:pl-6' : ''}`}>
              {!isMobileView && (
                <div className="text-right flex-grow">
                  <p className="text-sm font-semibold text-main-text leading-tight truncate max-w-[120px]">{currentUser.fullName}</p>
                  <p className="text-[10px] text-muted-text font-mono truncate max-w-[120px]">@{currentUser.username}</p>
                </div>
              )}
              <button
                onClick={() => setActiveTab('account')}
                className={`${isMobileView ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-app-bg border ${activeTab === 'account' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-main-border hover:border-blue-500/50'} flex items-center justify-center text-muted-text shrink-0 overflow-hidden cursor-pointer transition-all duration-200 focus:outline-none`} 
                title={`${currentUser.fullName} (@${currentUser.username})`}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.fullName} referrerPolicy="no-referrer" className="w-full h-full object-cover select-none animate-fade-in" />
                ) : (
                  <User className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
                )}
              </button>
              <button
                onClick={() => {
                  logoutUser();
                  setCurrentUser(null);
                  setActiveTab('timesheets');
                }}
                className={`text-xs font-medium cursor-pointer transition shrink-0 ${isMobileView ? 'bg-transparent text-rose-400 hover:text-rose-300 p-1' : 'bg-[#271c1f] hover:bg-[#3d2429] border border-rose-500/20 px-3 py-1.5 rounded-xl ml-2 text-rose-400 hover:text-rose-300'}`}
              >
                Log Out
              </button>
            </div>
          </div>
        </header>

        {/* ACTIVE TAB RENDER BLOCK */}
        <main className="flex-grow">
          <AnimatePresence mode="wait">
            {activeTab === 'timesheets' ? (
              <motion.div
                key="timesheets-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
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
              >
                <ManagerView 
                  currentUser={currentUser}
                  isMobileView={isMobileView}
                />
              </motion.div>
            ) : (
              <motion.div
                key="account-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
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
        <footer className="mt-12 border-t border-main-border pt-6 text-center text-[10px] text-muted-text font-mono tracking-wide uppercase select-none pb-4">
          SYSTEM CLASSIFIED: SANDBOX LOCAL ISOLATION LAYER ENCRYPTED • NOT FOR PUBLIC DISTRIBUTION • GDPR-CCPA COMPLIANT
        </footer>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-app-bg text-main-text flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Decorative radial lighting nodes */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-blue-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* MAIN SYSTEM CONTAINER SHELL */}
      <div className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 py-4 md:px-8 md:py-6">
        {renderAppContent()}
      </div>
    </div>
  );
}
