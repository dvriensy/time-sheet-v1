/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BellRing, ShieldCheck, Download, Trash2, KeySquare, 
  History, Info, ToggleLeft, Check, AlertTriangle, Eye, EyeOff, Clock
} from 'lucide-react';
import { 
  getReminderSettings, saveReminderSettings, 
  getAppSettings, saveAppSettings, 
  getSecurityLogs, clearSecurityLogs, 
  exportTimesheetsAsCSV, exportAllDataAsJSON, wipeAllLocalData 
} from '../utils/storage';
import { ReminderSettings, AppSettings, SecurityAuditLog } from '../types';

interface SettingsViewProps {
  onSettingsChanged: () => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
}

export default function SettingsView({ onSettingsChanged, privacyMode, onTogglePrivacy }: SettingsViewProps) {
  const initialReminders = useMemo(() => getReminderSettings(), []);
  const initialAppSettings = useMemo(() => getAppSettings(), []);
  const logs = useMemo(() => getSecurityLogs(), [onSettingsChanged]); // Refresh logs on change

  const [reminders, setReminders] = useState<ReminderSettings>(initialReminders);
  const [appSettings, setAppSettings] = useState<AppSettings>(initialAppSettings);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const calculateShiftDurationStr = (start: string, end: string) => {
    if (!start || !end) return '';
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return '';
      let diffMin = (eH * 60 + eM) - (sH * 60 + sM);
      if (diffMin < 0) diffMin += 24 * 60;
      const hrs = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      return `${hrs} hours ${mins > 0 ? mins + ' mins' : ''}`;
    } catch {
      return '';
    }
  };

  // Save Reminder configuration
  const handleSaveReminders = (updates: Partial<ReminderSettings>) => {
    const updated = { ...reminders, ...updates };
    setReminders(updated);
    saveReminderSettings(updated);
    onSettingsChanged();
  };

  // Save App configurations (Biometrics, Privacy default)
  const handleSaveAppSettings = (updates: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...updates };
    setAppSettings(updated);
    saveAppSettings(updated);
    onSettingsChanged();
  };

  // Export backups
  const triggerCSVDownload = () => {
    const csvContent = exportTimesheetsAsCSV();
    if (!csvContent) {
      showToast('Your timesheet ledger is currently empty. There is no historical data to export.');
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dvriensy_Timesheets_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV Timesheet Export complete.');
  };

  const triggerJSONDownload = () => {
    const jsonContent = exportAllDataAsJSON();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Timesheet_Tracker_GDPR_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('JSON Encrypted Backup complete.');
  };

  // Total state erasure (Wipe Data)
  const handleWipeData = () => {
    wipeAllLocalData();
    setReminders(getReminderSettings());
    setAppSettings(getAppSettings());
    setShowWipeConfirm(false);
    onSettingsChanged();
    showToast('GDPR structural data wipe complete.');
  };

  const showToast = (message: string) => {
    setCopiedNotification(message);
    setTimeout(() => {
      setCopiedNotification(null);
    }, 3000);
  };

  return (
    <div id="settings-view" className="space-y-6">
      
      {/* Dynamic Copied/Saved Toast Alert */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 rounded-2xl bg-[#18181B] border border-slate-800 px-4 py-3 shadow-2xl flex items-center gap-2.5"
          >
            <Check className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-100">{copiedNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-xl font-semibold text-slate-100">Preferences & Compliance</h1>
        <p className="text-xs text-slate-400">Configure automatic alarms, export local assets, audit logs, and GDPR constraints.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* LEFT & CENTER COLS: ALARMS AND PRIVACY EXPORTS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Automatic Reminder Configuration */}
          <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-1">
              <BellRing className="h-4 w-4 text-blue-400" />
              <span>Shift Alert Reminders</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">Manage alert reminders for prompt clocking in/out segments.</p>

            <div className="space-y-4">
              
              {/* Reminder 1: Clock-In */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/40 pb-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Daily Clock-In Alarm</h4>
                  <p className="text-[10px] text-slate-500">Alert if not clocked in by scheduled start</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    disabled={!reminders.clockInReminder}
                    value={reminders.clockInTime}
                    onChange={(e) => handleSaveReminders({ clockInTime: e.target.value })}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
                  />
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.clockInReminder} 
                      onChange={(e) => handleSaveReminders({ clockInReminder: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                  </label>
                </div>
              </div>

              {/* Reminder 2: Clock-Out */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/40 pb-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Daily Clock-Out Alarm</h4>
                  <p className="text-[10px] text-slate-500">Alert if shift exceeds scheduled threshold</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    disabled={!reminders.clockOutReminder}
                    value={reminders.clockOutTime}
                    onChange={(e) => handleSaveReminders({ clockOutTime: e.target.value })}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
                  />
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reminders.clockOutReminder} 
                      onChange={(e) => handleSaveReminders({ clockOutReminder: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                  </label>
                </div>
              </div>

              {/* Reminder 3: GPS alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Boundary Breach Alerts</h4>
                  <p className="text-[10px] text-slate-500">Alert on geofence border ingress / egress</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={reminders.geofenceReminder} 
                    onChange={(e) => handleSaveReminders({ geofenceReminder: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                </label>
              </div>

            </div>
          </div>

          {/* Section 2: GDPR & Industry Data Portability Controls */}
          <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>GDPR Data Portability Exporter</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">Download your locally compiled database records for transparency and backup audits.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* CSV button */}
              <div className="rounded-2xl border border-slate-800 bg-zinc-950/40 p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Timesheets Ledger (.CSV)</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Download full timesheet tables grouped dynamically into column segments ready for import to Microsoft Excel, Google Sheets, or corporate ERP ledgers.
                  </p>
                </div>
                <button
                  onClick={triggerCSVDownload}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  <span>Export Spreadsheet CSV</span>
                </button>
              </div>

              {/* JSON button */}
              <div className="rounded-2xl border border-slate-800 bg-zinc-950/40 p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Complete Vault Backup (.JSON)</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Download your fully encrypted private keys, geofences, reminders, timesheet entries, and security audit logs as a serialized portable structural object.
                  </p>
                </div>
                <button
                  onClick={triggerJSONDownload}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  <span>Download Complete Backup</span>
                </button>
              </div>

            </div>
          </div>

          {/* Section 3: Data erasure / Right to be Forgotten */}
          <div className="rounded-3xl border border-rose-950/20 bg-rose-500/5 p-6">
            <h2 className="text-sm font-medium text-rose-400 flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span>Right to Be Forgotten (Data Wipe)</span>
            </h2>
            <p className="text-xs text-rose-300/75 mb-4">
              GDPR Article 17 Compliant: Securely clear all cached storage keys. This operation is local and completely irreversible.
            </p>

            {!showWipeConfirm ? (
              <button
                onClick={() => setShowWipeConfirm(true)}
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-5 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
              >
                Trigger Irreversible Local Data Wipe
              </button>
            ) : (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/80 p-4 space-y-4">
                <p className="text-xs text-rose-200 leading-relaxed">
                  <strong>Warning:</strong> This will erase all timesheets, custom geofences, security credentials, configurations, and logs. It cannot be undone. Are you sure?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleWipeData}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition cursor-pointer"
                  >
                    Confirm, Wipe Ledger
                  </button>
                  <button
                    onClick={() => setShowWipeConfirm(false)}
                    className="rounded-xl border border-slate-800 bg-[#18181B] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: BIOMETRICS AND LIVE SECURITY AUDIT LOGS */}
        <div className="lg:col-span-1 space-y-6">

          {/* Standard Work Shift Card */}
          <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Standard Shift Hours</span>
            </h3>

            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Define your regular daily shift bounds. These values prepopulate the manual shift logger automatically.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase font-mono">Start Time</label>
                  <input
                    type="time"
                    value={appSettings.defaultStartTime || '07:30'}
                    onChange={(e) => handleSaveAppSettings({ defaultStartTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase font-mono">End Time</label>
                  <input
                    type="time"
                    value={appSettings.defaultEndTime || '16:00'}
                    onChange={(e) => handleSaveAppSettings({ defaultEndTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {appSettings.defaultStartTime && appSettings.defaultEndTime && (
                <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
                  <p className="text-[10px] text-blue-400 font-mono leading-relaxed">
                    Shift bounds: <strong>{calculateShiftDurationStr(appSettings.defaultStartTime, appSettings.defaultEndTime)}</strong> gross (includes standard unpaid breaks).
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Biometrics Toggle box */}
          <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
              <KeySquare className="h-4 w-4 text-blue-400" />
              <span>Security Handshake</span>
            </h3>

            <div className="space-y-4">
              {/* Toggle Biometrics */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 font-sans">Biometric lock screen</h4>
                  <p className="text-[10px] text-slate-500">Require fingerprint/face lock on launch</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={appSettings.biometricLockEnabled} 
                    onChange={(e) => handleSaveAppSettings({ biometricLockEnabled: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                </label>
              </div>

              {/* Toggle Privacy Mode (Mask Earnings) */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Earnings Shield</h4>
                  <p className="text-[10px] text-slate-500">Hide earnings figures in simple screens</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={privacyMode} 
                    onChange={onTogglePrivacy}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                </label>
              </div>
            </div>
          </div>

          {/* Security Logs Audit trail card */}
          <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-400 tracking-wider font-mono flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />
                  <span>Compliance Audit Trail</span>
                </h3>
                <button
                  onClick={() => { clearSecurityLogs(); onSettingsChanged(); }}
                  className="text-[9px] font-mono text-slate-500 hover:text-slate-300 transition uppercase cursor-pointer"
                >
                  Clear logs
                </button>
              </div>

              {/* Logs loop */}
              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {logs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 font-mono">No audit trail logs recorded yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="text-[10px] border-b border-slate-800/40 pb-2.5">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className={`font-bold ${
                          log.category === 'auth' ? 'text-indigo-400' :
                          log.category === 'geofence' ? 'text-blue-400' :
                          log.category === 'sync' ? 'text-sky-400' : 'text-blue-400'
                        }`}>{log.event}</span>
                        <span className="text-slate-600 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-400 text-[10px] leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Regulatory ISO and GDPR declaration */}
            <div className="mt-6 rounded-xl bg-zinc-950/60 border border-slate-800/60 p-3 flex gap-2">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] leading-relaxed text-slate-500 font-mono">
                REGULATORY STANDARD: ISO-27001 LOG FORWARDER MATCHES CRITICAL COMPLIANCE METADATA. LOCAL HOST ENVELOPE SECURES TRACE PARAMETERS FROM DISCLOSURE.
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
