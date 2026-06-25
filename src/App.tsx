/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Sun, Moon } from 'lucide-react';
import { getTimesheets, getAppSettings, initializeStorage, getCurrentUser, logoutUser, UserAccount } from './utils/storage';
import { TimesheetEntry } from './types';

// Import our modular sub-components
import UserAuthGate from './components/UserAuthGate';
import TimesheetManager from './components/TimesheetManager';

export default function App() {
  // Initialize standard LocalStorage templates on mount
  useEffect(() => {
    initializeStorage();
  }, []);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [privacyMode, setPrivacyMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('timesheets_tracker_theme') as 'light' | 'dark') || 'dark';
  });

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
              <div className={`${isMobileView ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-app-bg border border-main-border flex items-center justify-center text-muted-text shrink-0`} title={`${currentUser.fullName} (@${currentUser.username})`}>
                <User className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </div>
              <button
                onClick={() => {
                  logoutUser();
                  setCurrentUser(null);
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
          <TimesheetManager 
            entries={timesheets} 
            onRefreshEntries={handleRefreshAll}
            privacyMode={privacyMode}
            isMobileView={isMobileView}
          />
        </main>

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
