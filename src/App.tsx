/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Sun, Moon, Monitor, Smartphone } from 'lucide-react';
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

  const [viewMode, setViewMode] = useState<'computer' | 'iphone' | 'android'>(() => {
    return (localStorage.getItem('timesheets_tracker_view_mode') as 'computer' | 'iphone' | 'android') || 'computer';
  });

  const handleSetViewMode = (mode: 'computer' | 'iphone' | 'android') => {
    setViewMode(mode);
    localStorage.setItem('timesheets_tracker_view_mode', mode);
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

  if (viewMode === 'computer') {
    return (
      <div className="min-h-screen bg-app-bg text-main-text flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
        
        {/* Floating Device Simulator Switcher Toolbar */}
        <div className="bg-zinc-900 border-b border-zinc-800 text-zinc-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-md font-sans">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-300">Device Simulator</span>
          </div>

          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => handleSetViewMode('computer')}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'computer' 
                  ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Computer View</span>
            </button>
            
            <button
              onClick={() => handleSetViewMode('iphone')}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'iphone' 
                  ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-rose-400" />
              <span>iPhone View</span>
            </button>

            <button
              onClick={() => handleSetViewMode('android')}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'android' 
                  ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
              <span>Android View</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-zinc-400">
            <span>Active View: <strong>Computer View (Full Responsive Workspace)</strong></span>
          </div>
        </div>

        {/* Decorative radial lighting nodes */}
        <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-blue-500/5 to-transparent blur-3xl pointer-events-none" />

        {/* MAIN SYSTEM CONTAINER SHELL */}
        <div className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 py-4 md:px-8 md:py-6">
          {renderAppContent()}
        </div>
      </div>
    );
  }

  // Mobile Device simulated renders (iPhone / Android)
  return (
    <div className="min-h-screen bg-zinc-950 text-main-text flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      
      {/* Floating Device Simulator Switcher Toolbar */}
      <div className="bg-zinc-900 border-b border-zinc-800 text-zinc-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-md font-sans">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-300">Device Simulator</span>
        </div>

        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => handleSetViewMode('computer')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'computer' 
                ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Computer View</span>
          </button>
          
          <button
            onClick={() => handleSetViewMode('iphone')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'iphone' 
                ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 text-rose-400" />
            <span>iPhone View</span>
          </button>

          <button
            onClick={() => handleSetViewMode('android')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'android' 
                ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            <span>Android View</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-zinc-400">
          <span>Active View: <strong>{viewMode === 'iphone' ? 'iPhone 15 Pro (390 x 844)' : 'Android / Pixel 8 (412 x 915)'}</strong></span>
        </div>
      </div>

      {/* Simulator Presentation Layer */}
      <div className="flex-grow flex items-center justify-center bg-[#09090C] py-8 px-4 overflow-y-auto">
        <div className="relative flex flex-col items-center">
          {/* Label indicating model size and responsiveness */}
          <div className="absolute -top-6 text-[10px] font-mono text-zinc-500 uppercase tracking-widest select-none">
            {viewMode === 'iphone' ? 'Apple iOS Simulator Frame (Haptic)' : 'Google Android Simulator Frame (Material)'}
          </div>

          {/* DEVICE MOCKUP FRAME */}
          {viewMode === 'iphone' ? (
            <div className="w-[390px] h-[844px] rounded-[55px] border-[12px] border-zinc-800 bg-[#09090B] shadow-2xl relative flex flex-col overflow-hidden outline outline-2 outline-offset-1 outline-zinc-700/40 select-none transition-all duration-300">
              
              {/* Dynamic Island / Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 ml-12" />
              </div>

              {/* iOS Status Bar */}
              <div className="h-10 bg-app-bg px-6 flex items-center justify-between text-[11px] font-semibold text-main-text/80 select-none z-40 shrink-0">
                <span className="font-mono">9:41</span>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <svg className="w-3.5 h-3 text-main-text/85 fill-current" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L17.61 4.97C16.07 3.74 14.12 3 12 3zm0 18c4.97 0 9-4.03 9-9 0-2.12-.74-4.07-1.97-5.61L6.39 19.03C7.93 20.26 9.88 21 12 21z"/></svg>
                  <div className="w-5 h-2.5 rounded-sm border border-main-text/30 p-0.5 flex items-center">
                    <div className="h-full w-3.5 bg-main-text/80 rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* Frame inner App view container */}
              <div className="flex-grow overflow-y-auto w-full relative h-full bg-app-bg">
                {renderAppContent(true)}
              </div>

              {/* Bottom Home gesture line */}
              <div className="h-5 bg-app-bg relative flex items-center justify-center z-40 shrink-0">
                <div className="w-32 h-1 bg-main-text/30 rounded-full" />
              </div>
            </div>
          ) : (
            <div className="w-[412px] h-[915px] rounded-[40px] border-[10px] border-zinc-800 bg-[#09090B] shadow-2xl relative flex flex-col overflow-hidden outline outline-2 outline-offset-1 outline-zinc-700/40 select-none transition-all duration-300">
              
              {/* Android Hole Punch Camera */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-50" />

              {/* Android Status Bar */}
              <div className="h-8 bg-app-bg px-6 flex items-center justify-between text-[11px] font-medium text-main-text/80 select-none z-40 shrink-0">
                <span className="font-mono">10:00</span>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <span className="text-[9px] font-mono font-bold tracking-tighter text-blue-500">5G</span>
                  <svg className="w-3 h-3 text-main-text/85 fill-current" viewBox="0 0 24 24"><path d="M2 22h20V2z"/></svg>
                  <svg className="w-3 h-3 text-main-text/85 fill-current" viewBox="0 0 24 24"><path d="M17 5H16V3H8V5H7C5.9 5 5 5.9 5 7V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V7C19 5.9 18.1 5 17 5Z"/></svg>
                </div>
              </div>

              {/* Frame inner App view container */}
              <div className="flex-grow overflow-y-auto w-full relative h-full bg-app-bg">
                {renderAppContent(true)}
              </div>

              {/* Bottom Gesture line */}
              <div className="h-5 bg-app-bg relative flex items-center justify-center z-40 shrink-0">
                <div className="w-24 h-1 bg-main-text/25 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
