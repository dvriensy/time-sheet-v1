/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Check, X, RotateCcw, Sparkles, Monitor, Maximize2, ShieldCheck } from 'lucide-react';
import {
  PHONE_MODEL_PRESETS,
  PhoneModelId,
  TopInsetMode,
  BottomInsetMode,
  DeviceProfileSettings,
  getDeviceProfile,
  saveDeviceProfile,
  detectHardwareEnvironment,
} from '../utils/deviceProfile';

interface PhoneSizingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneSizingModal: React.FC<PhoneSizingModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<DeviceProfileSettings>(() => getDeviceProfile());
  const [hwInfo, setHwInfo] = useState(() => detectHardwareEnvironment());
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getDeviceProfile());
      setHwInfo(detectHardwareEnvironment());
    }
  }, [isOpen]);

  const handleSelectModel = (modelId: PhoneModelId) => {
    const preset = PHONE_MODEL_PRESETS.find((p) => p.id === modelId);
    if (!preset) return;
    const next: DeviceProfileSettings = {
      phoneModel: modelId,
      uiScale: preset.defaultScale,
      topInsetMode: preset.defaultTopInset,
      bottomInsetMode: preset.defaultBottomInset,
      compactCards: preset.defaultCompact,
    };
    setSettings(next);
    saveDeviceProfile(next);
    triggerToast();
  };

  const handleUpdateField = (patch: Partial<DeviceProfileSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveDeviceProfile(next);
    triggerToast();
  };

  const handleResetAuto = () => {
    const next: DeviceProfileSettings = {
      phoneModel: 'auto',
      uiScale: 1.0,
      topInsetMode: 'auto',
      bottomInsetMode: 'auto',
      compactCards: false,
    };
    setSettings(next);
    saveDeviceProfile(next);
    triggerToast();
  };

  const triggerToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl bg-card-bg border border-main-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-main-border bg-app-bg/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-500 border border-blue-500/30 shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-main-text truncate">
                  Phone & App Screen Sizing
                </h2>
                <p className="text-[11px] text-muted-text truncate">
                  Select your iPhone or Android model to calibrate standalone app fit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-main-border bg-card-bg text-muted-text hover:text-main-text transition cursor-pointer shrink-0"
              aria-label="Close sizing settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-left">
            {/* Detected Hardware Banner */}
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="text-xs">
                  <span className="text-muted-text font-mono">Detected: </span>
                  <strong className="text-main-text font-semibold uppercase">
                    {hwInfo.os === 'ios' ? 'iPhone / iOS' : hwInfo.os === 'android' ? 'Android' : 'Desktop / Web'}
                  </strong>
                  <span className="text-muted-text font-mono">
                    {' '}• {hwInfo.width}×{hwInfo.height}px •{' '}
                    {hwInfo.isStandalone ? 'Home Screen App (Standalone)' : 'Browser View'}
                  </span>
                </div>
              </div>
              {savedToast && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <Check className="h-3 w-3" /> Applied Live
                </span>
              )}
            </div>

            {/* Step 1: Tell the app what phone you have */}
            <div className="space-y-2.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-text font-mono">
                1. What Phone Are You Using?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PHONE_MODEL_PRESETS.map((preset) => {
                  const isSelected = settings.phoneModel === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectModel(preset.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-600/15 text-main-text shadow-md shadow-blue-500/10'
                          : 'border-main-border bg-input-bg/50 hover:border-blue-500/40 text-muted-text hover:text-main-text'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {preset.platform === 'desktop' ? (
                            <Monitor className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-muted-text'}`} />
                          ) : (
                            <Smartphone className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-muted-text'}`} />
                          )}
                          <span className="text-xs font-bold text-main-text truncate">{preset.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-text leading-snug">{preset.subtitle}</p>
                        <span className="inline-block text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded mt-1">
                          {preset.screenSpec}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-main-border bg-card-bg'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Fine-Tune UI Scale & Density */}
            <div className="space-y-2.5 pt-2 border-t border-main-border/50">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-text font-mono">
                  2. App Text & Card Sizing Scale
                </label>
                <span className="text-xs font-mono font-bold text-blue-400">
                  {Math.round(settings.uiScale * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Compact (88%)', val: 0.88 },
                  { label: 'Fitted (94%)', val: 0.94 },
                  { label: 'Standard (100%)', val: 1.0 },
                  { label: 'Large (105%)', val: 1.05 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handleUpdateField({ uiScale: opt.val })}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      Math.abs(settings.uiScale - opt.val) < 0.02
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : 'bg-input-bg/60 text-muted-text hover:text-main-text border-main-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Top Notch / Dynamic Island / Status Bar Clearance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-main-border/50">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-text font-mono">
                  3. Top Notch / Dynamic Island Space
                </label>
                <select
                  value={settings.topInsetMode}
                  onChange={(e) => handleUpdateField({ topInsetMode: e.target.value as TopInsetMode })}
                  className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2.5 text-xs font-semibold text-main-text focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto (Smart Safe Area)</option>
                  <option value="none">None (0px Extra)</option>
                  <option value="status_bar">Android Status Bar (+12px)</option>
                  <option value="notch">iPhone Notch (+20px)</option>
                  <option value="dynamic_island">iPhone Dynamic Island (+28px)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-text font-mono">
                  4. Bottom Home Bar Clearance
                </label>
                <select
                  value={settings.bottomInsetMode}
                  onChange={(e) => handleUpdateField({ bottomInsetMode: e.target.value as BottomInsetMode })}
                  className="w-full rounded-xl border border-main-border bg-input-bg px-3 py-2.5 text-xs font-semibold text-main-text focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto (Smart Safe Area)</option>
                  <option value="none">None (0px Extra)</option>
                  <option value="gesture_bar">Android Gesture Bar (+10px)</option>
                  <option value="home_bar">iPhone Home Indicator (+14px)</option>
                </select>
              </div>
            </div>

            {/* Compact Card Spacing Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-main-border bg-input-bg/40">
              <div className="space-y-0.5 pr-3">
                <span className="text-xs font-bold text-main-text flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5 text-blue-400" />
                  Compact Mobile App Density
                </span>
                <p className="text-[11px] text-muted-text">
                  Reduces extra margins so the timer, FLHA upload, and shift logs fit cleanly on phone screens without cutoffs.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.compactCards}
                  onChange={(e) => handleUpdateField({ compactCards: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-t border-main-border bg-app-bg/60 shrink-0">
            <button
              type="button"
              onClick={handleResetAuto}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-main-border bg-card-bg hover:bg-input-bg text-xs font-semibold text-muted-text hover:text-main-text transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Auto</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Done</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PhoneSizingModal;
