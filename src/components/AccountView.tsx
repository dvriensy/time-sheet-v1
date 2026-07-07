/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, Briefcase, DollarSign, Camera, Save, 
  Sparkles, CheckCircle2, RefreshCw, LogOut, Clock, Landmark,
  Trash2
} from 'lucide-react';
import { UserAccount, updateUserAccount, getTimesheets } from '../utils/storage';

interface AccountViewProps {
  currentUser: UserAccount;
  onUpdateUser: (user: UserAccount) => void;
  onLogout: () => void;
  isMobileView?: boolean;
}

// Helper to generate dynamic SVG avatar on the fly
const makeSvgAvatar = (emoji: string, gradientStart: string, gradientEnd: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#grad)" />
    <text x="50" y="65" font-size="52" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Beautiful predefined avatars
const PRESET_AVATARS = [
  { emoji: '🧑‍💻', start: '#3b82f6', end: '#8b5cf6', label: 'Developer' },
  { emoji: '👩‍🎨', start: '#ec4899', end: '#f43f5e', label: 'Designer' },
  { emoji: '🚀', start: '#f59e0b', end: '#ef4444', label: 'Builder' },
  { emoji: '💼', start: '#10b981', end: '#06b6d4', label: 'Executive' },
  { emoji: '🦊', start: '#f97316', end: '#f59e0b', label: 'Fox' },
  { emoji: '🐱', start: '#6366f1', end: '#ec4899', label: 'Coder Cat' },
  { emoji: '🦉', start: '#8b5cf6', end: '#06b6d4', label: 'Zen Owl' },
  { emoji: '☕', start: '#b45309', end: '#78350f', label: 'Coffee Addict' },
];

export default function AccountView({ currentUser, onUpdateUser, onLogout, isMobileView = false }: AccountViewProps) {
  // Local editable form states
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [department, setDepartment] = useState(currentUser.department || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [hourlyRate, setHourlyRate] = useState<number>(currentUser.hourlyRate || 45);
  
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [role, setRole] = useState<'employee' | 'manager'>(currentUser.role || 'employee');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Account deletion states
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: currentUser.username })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete account on server');
      }

      const result = await response.json();
      if (result.success) {
        console.log('Account deleted successfully on server. Performing hard logout...');
        
        // 1. Clear local storage
        localStorage.clear();

        // 2. Clear document cookies if any
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }

        // 3. Force hard redirect to login/home page
        window.location.href = '/';
      } else {
        throw new Error('Server returned unsuccessful deletion response');
      }
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute stats based on actual logged entries
  const userEntries = getTimesheets();
  const totalShifts = userEntries.length;
  const totalHours = userEntries.reduce((sum, e) => sum + e.totalHours, 0);
  const calculatedEarnings = totalHours * hourlyRate;

  // Handle custom image uploads (Base64 conversion)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarUrl(base64String);
      setSuccessMessage('Custom image uploaded successfully! Click save to apply.');
      setTimeout(() => setSuccessMessage(null), 3500);
    };
    reader.readAsDataURL(file);
  };

  const selectPresetAvatar = (emoji: string, start: string, end: string) => {
    const generatedUrl = makeSvgAvatar(emoji, start, end);
    setAvatarUrl(generatedUrl);
    setShowAvatarPicker(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updated = updateUserAccount({
      fullName,
      email,
      phone,
      department,
      bio,
      hourlyRate,
      avatarUrl,
      role
    });

    if (updated) {
      onUpdateUser(updated);
      setSuccessMessage('Your profile changes have been securely saved.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  return (
    <div className="w-full space-y-6 max-w-4xl mx-auto animate-fade-in" id="account-page-view">
      
      {/* SUCCESS BANNER NOTIFICATION */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-emerald-500 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: PROFILE BADGE & PRESET AVATARS (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card: Picture & Identity */}
          <div className="bg-card-bg border border-main-border rounded-2xl p-5 md:p-6 shadow-xl flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider mb-5 font-mono">
              Identity Badge
            </h3>
            
            {/* Avatar Display */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-full border-2 border-blue-500/30 bg-app-bg flex items-center justify-center text-muted-text shadow-inner overflow-hidden">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile Avatar" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none"
                  />
                ) : (
                  <User className="h-14 w-14 text-muted-text/50" />
                )}
              </div>
              
              <label 
                htmlFor="avatar-file-upload"
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-500 text-white rounded-full p-2.5 shadow-md cursor-pointer transition border border-blue-400/20 hover:scale-105 active:scale-95"
                title="Upload Profile Picture"
              >
                <Camera className="h-4 w-4" />
                <input 
                  type="file" 
                  id="avatar-file-upload" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            <h4 className="text-lg font-bold text-main-text mt-4 leading-tight">
              {currentUser.fullName}
            </h4>
            <p className="text-xs text-muted-text font-mono mt-1">
              @{currentUser.username}
            </p>

            {department && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-500 border border-blue-500/20 mt-3">
                <Briefcase className="h-3 w-3" />
                {department}
              </span>
            )}

            {bio && (
              <p className="text-xs text-muted-text mt-4 italic max-w-xs leading-relaxed border-t border-main-border/40 pt-4 w-full">
                "{bio}"
              </p>
            )}

            {/* Quick avatar selection expander */}
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="mt-6 flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-400 bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10 cursor-pointer transition"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>{showAvatarPicker ? 'Hide Avatar Gallery' : 'Choose Prebuilt Avatar'}</span>
            </button>

            {/* Prebuilt Gallery drawer */}
            <AnimatePresence>
              {showAvatarPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-4 w-full"
                >
                  <div className="bg-app-bg/50 border border-main-border/60 rounded-xl p-3.5 mt-1">
                    <p className="text-[10px] font-mono text-muted-text uppercase tracking-wider mb-2.5">
                      Select modern vector design:
                    </p>
                    <div className="grid grid-cols-4 gap-2.5">
                      {PRESET_AVATARS.map((preset, index) => {
                        const demoUrl = makeSvgAvatar(preset.emoji, preset.start, preset.end);
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectPresetAvatar(preset.emoji, preset.start, preset.end)}
                            className="w-11 h-11 rounded-full overflow-hidden hover:scale-110 active:scale-95 transition border border-main-border shadow-sm focus:outline-none cursor-pointer hover:border-blue-500"
                            title={preset.label}
                          >
                            <img src={demoUrl} alt={preset.label} className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card: Ledger Stats */}
          <div className="bg-card-bg border border-main-border rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-blue-500" />
              Contract Performance
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-app-bg/40 p-3 rounded-xl border border-main-border/60 font-mono">
                <span className="text-[10px] text-muted-text uppercase tracking-wider block">Shifts Logged</span>
                <span className="text-base font-bold text-main-text">{totalShifts}</span>
              </div>
              <div className="bg-app-bg/40 p-3 rounded-xl border border-main-border/60 font-mono">
                <span className="text-[10px] text-muted-text uppercase tracking-wider block">Total Hours</span>
                <span className="text-base font-bold text-main-text">{totalHours.toFixed(2)}h</span>
              </div>
            </div>

            <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider block">Earnings</span>
                  <span className="text-lg font-black text-blue-500 font-mono">
                    ${calculatedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[10px] text-right font-mono text-muted-text space-y-0.5">
                  <span className="block">Current Rate:</span>
                  <span className="font-bold text-main-text">${hourlyRate}/hr</span>
                </div>
              </div>
            </div>

            <div className="border-t border-main-border/40 pt-4 flex justify-between items-center">
              <span className="text-[10px] font-mono text-muted-text uppercase">Ledger Source</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                Sandbox Mode
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED EDITABLE PROFILE FORM (8 cols) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSave} className="bg-card-bg border border-main-border rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="border-b border-main-border/60 pb-5">
              <h2 className="text-lg font-bold text-main-text">Profile Information</h2>
              <p className="text-xs text-muted-text mt-1">Configure and edit your identity, system information, and contract parameters.</p>
            </div>

            {/* Row 1: Name & Username */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/50">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={`@${currentUser.username}`}
                    disabled
                    className="w-full rounded-xl border border-main-border bg-input-bg/50 pl-10 pr-4 py-2.5 text-sm text-muted-text/80 cursor-not-allowed font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Email & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="e.g. name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Telephone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 019-2834"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Role/Department & Hourly rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                  Job Department / Role
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Senior Software Designer"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono flex items-center justify-between">
                  <span>Contract Hourly Rate ($)</span>
                  <span className="text-[9px] text-blue-500 font-normal">Sets Pay Sheet Defaults</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-text/70">
                    <DollarSign className="h-4 w-4" />
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-main-border bg-input-bg pl-10 pr-4 py-2.5 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Biography */}
            <div>
              <label className="block text-[10px] font-semibold text-muted-text uppercase tracking-wider mb-1.5 font-mono">
                Short Biography
              </label>
              <textarea
                rows={3}
                placeholder="A brief memo or summary details about your role, working contract, or timesheet reminders..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-main-border bg-input-bg px-4 py-3 text-sm text-main-text placeholder-muted-text/40 focus:border-blue-500/40 focus:outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Read-only details */}
            <div className="bg-app-bg/50 border border-main-border/60 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-muted-text/60" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-main-text leading-tight">Ledger Username</p>
                  <p className="text-[10px] text-muted-text font-mono leading-none">Cannot be changed after registration</p>
                </div>
              </div>
              <span className="text-xs font-semibold font-mono text-muted-text/90 bg-card-bg px-3 py-1.5 rounded-lg border border-main-border/80">
                @{currentUser.username}
              </span>
            </div>

            {/* Save Buttons & Logout */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-main-border/60 pt-6 gap-4">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-500 cursor-pointer transition w-full sm:w-auto justify-center"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out Account</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all w-full sm:w-auto justify-center"
              >
                <Save className="h-4 w-4" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>

          {/* DANGER ZONE FOR ACCOUNT DELETION */}
          <div className="bg-card-bg border border-red-500/25 rounded-2xl p-6 md:p-8 shadow-xl space-y-4">
            <div className="border-b border-red-500/15 pb-4">
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider font-mono">
                Danger Zone
              </h3>
              <p className="text-xs text-muted-text mt-1">
                Irreversible administrative action. Deleting your account will wipe all recorded sessions permanently.
              </p>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-left">
              <p className="text-xs text-red-400 font-medium leading-relaxed">
                Warning: This will permanently delete your account (@{currentUser.username}) and automatically clear all of your associated timesheet entries, scheduled shifts, and active status logs from the secure Firestore database. This action cannot be undone.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="space-y-0.5 text-left font-sans">
                <span className="text-xs font-semibold text-main-text block">Delete Profile & Timesheets</span>
                <p className="text-[10px] text-muted-text leading-tight">Requires server verification and hard logout</p>
              </div>

              {confirmDelete ? (
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <span className="text-xs text-red-400 font-bold animate-pulse font-mono">CONFIRM PERMANENT DELETION?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-500/15 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmDelete(false)}
                    className="bg-app-bg hover:bg-main-border/30 border border-main-border text-slate-300 text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete My Account</span>
                </button>
              )}
            </div>
            {deleteError && (
              <p className="text-xs font-semibold text-red-400 font-mono mt-2 text-left">{deleteError}</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
