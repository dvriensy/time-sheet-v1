/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, UserPlus, Clock, ArrowRight, ShieldCheck, Sun, Moon } from 'lucide-react';
import { registerUser, loginUser, getCurrentUser, UserAccount } from '../utils/storage';

interface UserAuthGateProps {
  onAuthSuccess: (user: UserAccount) => void;
  isMobileView?: boolean;
}

export default function UserAuthGate({ onAuthSuccess, isMobileView = false }: UserAuthGateProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('timesheets_tracker_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (localTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('timesheets_tracker_theme', localTheme);
  }, [localTheme]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please fill in both Username and Password.');
      return;
    }

    if (isLogin) {
      const success = loginUser(username.trim(), password);
      if (success) {
        const user = getCurrentUser();
        if (user) {
          onAuthSuccess(user);
        }
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } else {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }

      const success = registerUser(
        username.trim(),
        password,
        fullName.trim()
      );

      if (success) {
        const user = getCurrentUser();
        if (user) {
          onAuthSuccess(user);
        }
      } else {
        setError('Username already exists. Please choose another one.');
      }
    }
  };

  return (
    <div id="auth-gate-container" className={`absolute inset-0 z-40 flex items-center justify-center bg-app-bg px-4 transition-colors duration-200 overflow-y-auto ${isMobileView ? 'py-4' : 'py-12'}`}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-blue-500/10 to-transparent blur-3xl pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md rounded-3xl border border-main-border bg-card-bg ${isMobileView ? 'p-5' : 'p-8'} shadow-2xl relative transition-all duration-200`}
      >
        {/* Absolute positioned theme toggle button */}
        <button
          onClick={() => setLocalTheme(localTheme === 'dark' ? 'light' : 'dark')}
          className={`absolute ${isMobileView ? 'top-4 right-4 p-1.5' : 'top-6 right-6 p-2'} rounded-xl border border-main-border bg-app-bg text-muted-text hover:text-main-text transition duration-200 cursor-pointer flex items-center justify-center shadow-sm hover:scale-105 active:scale-95`}
          type="button"
          title={localTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {localTheme === 'dark' ? (
            <Sun className={`${isMobileView ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-amber-400`} />
          ) : (
            <Moon className={`${isMobileView ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-blue-600`} />
          )}
        </button>

        <div className={`flex flex-col items-center ${isMobileView ? 'mb-4' : 'mb-6'} text-center`}>
          <div className={`${isMobileView ? 'h-10 w-10 mb-2 rounded-xl' : 'h-12 w-12 mb-3 rounded-2xl'} bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse`}>
            <Clock className={`${isMobileView ? 'h-5 w-5' : 'h-6 w-6'} text-white`} />
          </div>
          <h1 className={`${isMobileView ? 'text-lg' : 'text-xl'} font-bold text-main-text uppercase tracking-tight`}>
            TIME <span className="text-blue-500">SHEETS</span>
          </h1>
          <p className="text-xs text-muted-text mt-1">
            {isLogin ? 'Verify your identity to log hours' : 'Create an account to start tracking'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john_doe"
                className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                    <UserPlus className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                    required={!isLogin}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 shadow-lg shadow-blue-500/10 active:scale-[0.99] transition mt-6 cursor-pointer"
          >
            <span>{isLogin ? 'Log In Securely' : 'Create & Log In'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-main-border text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs text-blue-500 hover:text-blue-400 transition font-medium cursor-pointer"
          >
            {isLogin ? "Don't have an account? Register one now" : 'Already have an account? Sign in here'}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-text font-mono">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500/60" />
          <span>ISO-27001 LOCAL STORAGE ENVELOPE SECURED</span>
        </div>
      </motion.div>
    </div>
  );
}
