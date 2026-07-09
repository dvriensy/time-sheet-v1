/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserPlus, Clock, ArrowRight, ShieldCheck, Sun, Moon, Lock } from 'lucide-react';
import { registerUser, loginUser, getCurrentUser, UserAccount, getAllUsers, resetUserPassword, registerUserClient, loginUserClient } from '../utils/storage';

interface UserAuthGateProps {
  onAuthSuccess: (user: UserAccount) => void;
  isMobileView?: boolean;
}

export default function UserAuthGate({ onAuthSuccess, isMobileView = false }: UserAuthGateProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot password form states
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotFullName, setForgotFullName] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [existingUsers, setExistingUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    setExistingUsers(getAllUsers());
    
    const handleSync = () => {
      setExistingUsers(getAllUsers());
    };
    window.addEventListener('storage-sync', handleSync);
    return () => window.removeEventListener('storage-sync', handleSync);
  }, [isLogin, isForgot]);

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

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const uName = forgotUsername.trim().toLowerCase();
    const fName = forgotFullName.trim();
    const newPass = forgotNewPassword.trim();

    if (!uName || !fName || !newPass) {
      setError('Please fill out all fields.');
      return;
    }

    const resetSuccess = resetUserPassword(uName, fName, newPass);
    if (resetSuccess) {
      setSuccessMsg(`Successfully reset password for @${uName}! You can now go back and log in.`);
      setForgotUsername('');
      setForgotFullName('');
      setForgotNewPassword('');
    } else {
      setError('Account verification failed. The username and full name did not match any registered user.');
    }
  };

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (loading) return;

    const pwd = password.trim();

    if (isLogin) {
      const targetLogin = loginInput.trim();
      if (!targetLogin) {
        setError('Please enter your Username or Full Name.');
        return;
      }
      setLoading(true);
      try {
        const result = await loginUserClient(targetLogin, pwd);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
        } else {
          setError(result.error || `Incorrect password, or no account found under "${targetLogin}".`);
        }
      } catch (err: any) {
        console.error("Login verification error:", err);
        setError("Unable to log in. Please check your internet connection.");
      } finally {
        setLoading(false);
      }
    } else {
      const name = fullName.trim();
      const uName = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      
      if (!name) {
        setError('Please enter your Full Name.');
        return;
      }
      if (!uName) {
        setError('Please choose a valid Username (alphanumeric, underscores, dots, hyphens).');
        return;
      }
      if (!pwd) {
        setError('Please choose a password for registration.');
        return;
      }
      
      setLoading(true);
      try {
        const result = await registerUserClient(name, uName, pwd, 45, true);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
        } else {
          setError(result.error || "Failed to register account on live database.");
        }
      } catch (err: any) {
        console.error("Signup client-side error:", err);
        setError("Registration error: Failed to connect directly to the database.");
      } finally {
        setLoading(false);
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
          <div className={`${isMobileView ? 'h-10 w-10 mb-2.5 rounded-xl' : 'h-12 w-12 mb-3.5 rounded-2xl'} bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/10`}>
            <Clock className={`${isMobileView ? 'h-5 w-5' : 'h-5.5 w-5.5'} text-white`} />
          </div>
          <h1 className={`${isMobileView ? 'text-xl' : 'text-2xl'} font-display font-bold text-main-text tracking-tight`}>
            TIME<span className="text-blue-500 font-normal">LEDGER</span>
          </h1>
          <p className="text-xs text-muted-text mt-1.5 max-w-[280px] leading-relaxed">
            {isForgot ? 'Reset your account password' : isLogin ? 'Securely sign in to manage and log hours' : 'Create an account to start tracking'}
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
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 font-medium"
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {isForgot ? (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                  <UserPlus className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  placeholder="e.g. derek_vriens"
                  className="w-full rounded-xl border border-main-border bg-input-bg pl-9 pr-3 py-2 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                Full Name (Verification)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={forgotFullName}
                  onChange={(e) => setForgotFullName(e.target.value)}
                  placeholder="e.g. Derek Vriens"
                  className="w-full rounded-xl border border-main-border bg-input-bg pl-9 pr-3 py-2 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="Enter a secure new password"
                  className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 shadow-lg shadow-blue-500/10 active:scale-[0.99] transition mt-6 cursor-pointer"
            >
              <span>Reset & Update Password</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isLogin ? (
              <div>
                <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Username or Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. derek_vriens or John Doe"
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-9 pr-3 py-2 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full rounded-xl border border-main-border bg-input-bg pl-9 pr-3 py-2 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      className="w-full rounded-xl border border-main-border bg-input-bg pl-9 pr-3 py-2 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

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
                  placeholder={isLogin ? "••••••••" : "Choose a secure password"}
                  className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/60 focus:border-blue-500/50 focus:outline-none transition-colors"
                  required={!isLogin}
                />
              </div>
            </div>

             <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold py-3 px-4 shadow-lg transition mt-6 cursor-pointer ${
                loading 
                  ? 'bg-blue-600/60 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/10 active:scale-[0.99]'
              }`}
            >
              <span>
                {loading 
                  ? 'Saving to cloud database...' 
                  : isLogin 
                    ? 'Log In Securely' 
                    : 'Create & Log In'
                }
              </span>
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-main-border flex flex-col gap-3 text-center">
          {isForgot ? (
            <button
              onClick={() => {
                setIsForgot(false);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-blue-500 hover:text-blue-400 transition font-medium cursor-pointer"
            >
              Back to Sign In
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-xs text-blue-500 hover:text-blue-400 transition font-medium cursor-pointer"
              >
                {isLogin ? "Don't have an account? Register one now" : 'Already have an account? Sign in here'}
              </button>
              <button
                onClick={() => {
                  setIsForgot(true);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-muted-text hover:text-main-text transition font-medium cursor-pointer"
              >
                Forgot your password? Reset it here
              </button>
            </>
          )}
        </div>

        {existingUsers.length > 0 && (
          <div className="mt-5 pt-5 border-t border-main-border text-left">
            <span className="block text-[10px] font-bold text-muted-text uppercase tracking-wider mb-2.5 font-mono">
              Quick-Select Registered Accounts
            </span>
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
              {existingUsers.map((user) => (
                <button
                  key={user.username}
                  onClick={() => {
                    setLoginInput(user.username);
                    setPassword(user.password || '');
                    setIsLogin(true);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-app-bg hover:bg-main-border/30 border border-main-border text-left transition text-xs font-semibold text-main-text group cursor-pointer"
                  type="button"
                >
                  <div className="w-6 h-6 rounded-full bg-card-bg border border-main-border overflow-hidden shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-text/50">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <span className="block truncate leading-tight text-xs">{user.fullName}</span>
                    <span className="block text-[9px] font-mono text-muted-text font-normal truncate">
                      @{user.username} {user.role === 'manager' ? '👑' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-text font-mono">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500/60" />
          <span>ISO-27001 LOCAL STORAGE ENVELOPE SECURED</span>
        </div>
      </motion.div>
    </div>
  );
}
