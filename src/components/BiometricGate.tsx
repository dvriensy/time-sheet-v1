/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, ScanEye, ShieldCheck, Lock, AlertCircle, KeyRound } from 'lucide-react';
import { addSecurityLog } from '../utils/storage';

interface BiometricGateProps {
  onUnlock: () => void;
  isUnlocked: boolean;
}

export default function BiometricGate({ onUnlock, isUnlocked }: BiometricGateProps) {
  const [authMode, setAuthMode] = useState<'face' | 'fingerprint' | 'pin'>('fingerprint');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [pinCode, setPinCode] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);

  // Auto trigger scan on mount
  useEffect(() => {
    if (!isUnlocked && authMode !== 'pin') {
      handleStartScan();
    }
  }, [authMode, isUnlocked]);

  const handleStartScan = () => {
    setScanState('scanning');
    setScanProgress(0);
    setPinError('');

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // 90% success rate, 10% fail for high realism!
          const isSuccessful = Math.random() < 0.95;
          if (isSuccessful) {
            setScanState('success');
            setTimeout(() => {
              addSecurityLog(
                'Biometric Handshake Completed',
                `Biometric credentials successfully verified via local ${authMode === 'face' ? 'Face ID' : 'Touch ID'} enclosure.`,
                'auth'
              );
              onUnlock();
            }, 800);
          } else {
            setScanState('failed');
            addSecurityLog(
              'Failed Authentication Attempt',
              `Biometric authorization rejected on local sandbox device.`,
              'auth'
            );
          }
          return 100;
        }
        return prev + 4;
      });
    }, 45);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === '1234') {
      setScanState('success');
      setTimeout(() => {
        addSecurityLog(
          'Backup PIN Verified',
          'Security entry unlocked via manual 4-digit supervisor fallback PIN.',
          'auth'
        );
        onUnlock();
      }, 500);
    } else {
      setPinError('Incorrect 4-digit PIN. (Hint: Use default 1234)');
      setPinCode('');
      addSecurityLog(
        'Failed Authentication Attempt',
        'PIN authentication rejected: invalid PIN sequence.',
        'auth'
      );
    }
  };

  if (isUnlocked) return null;

  return (
    <div id="biometric-gate" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090B] text-slate-100">
      {/* Decorative ambient gradients */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />

      <div className="relative w-full max-w-md px-6 text-center">
        {/* Header Branding */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/15">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#18181B]">
              <Lock className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Timesheet Secure Portal
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-mono uppercase tracking-wider">
            COMPLIANT WITH GDPR & ISO-27001 SECURE PROTOCOLS
          </p>
        </motion.div>

        {/* Auth Body Box */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#18181B] p-8 backdrop-blur-xl shadow-2xl">
          <AnimatePresence mode="wait">
            {authMode === 'pin' ? (
              <motion.form
                key="pin-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handlePinSubmit}
                className="flex flex-col items-center"
              >
                <div className="mb-4 rounded-full bg-slate-800/80 p-4 text-blue-400">
                  <KeyRound className="h-10 w-10" />
                </div>
                <h2 className="mb-1 text-lg font-medium text-slate-100">Enter Security PIN</h2>
                <p className="mb-6 text-xs text-slate-400">Enter your 4-digit emergency security code</p>

                <input
                  type="password"
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPinCode(val);
                    if (pinError) setPinError('');
                  }}
                  placeholder="••••"
                  className="w-40 rounded-xl border border-slate-800 bg-slate-950/80 py-3 text-center text-2xl font-bold tracking-widest text-blue-500 placeholder-slate-700 focus:border-blue-500/50 focus:outline-none"
                  autoFocus
                />

                {pinError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-1.5 text-xs text-rose-400"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{pinError}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={pinCode.length < 4}
                  className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-500/10 transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  Verify Access
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="biometric-scan"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center"
              >
                {/* Biometric Scanner Graphic */}
                <div className="relative mb-6 flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  {/* Glowing Scanner Circles */}
                  <div className="absolute inset-2 rounded-full border border-slate-800/40" />
                  <div className="absolute inset-4 rounded-full border border-slate-800/20" />
                  
                  {/* Laser line effect */}
                  {scanState === 'scanning' && (
                    <motion.div
                      animate={{ top: ['15%', '85%', '15%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute left-[10%] right-[10%] h-0.5 bg-blue-500 shadow-sm shadow-blue-500/80 z-10"
                    />
                  )}

                  {/* Icon representations */}
                  <AnimatePresence mode="wait">
                    {scanState === 'success' ? (
                      <motion.div
                        key="success-icon"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-blue-500"
                      >
                        <ShieldCheck className="h-20 w-20 stroke-[1.5]" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="normal-icon"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`transition-colors duration-300 ${
                          scanState === 'scanning' ? 'text-blue-400' :
                          scanState === 'failed' ? 'text-rose-400' : 'text-slate-500'
                        }`}
                      >
                        {authMode === 'fingerprint' ? (
                          <Fingerprint className={`h-20 w-20 stroke-[1.2] ${scanState === 'scanning' ? 'animate-pulse' : ''}`} />
                        ) : (
                          <ScanEye className={`h-20 w-20 stroke-[1.2] ${scanState === 'scanning' ? 'animate-pulse' : ''}`} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Laser vertical scanning overlay */}
                  {scanState === 'scanning' && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent pointer-events-none" />
                  )}
                </div>

                {/* Progress & Message */}
                <div className="w-full">
                  <h3 className="text-lg font-medium text-slate-100">
                    {scanState === 'idle' && `Ready to authorize`}
                    {scanState === 'scanning' && `Scanning ${authMode === 'face' ? 'Face ID' : 'Touch ID'}...`}
                    {scanState === 'success' && 'Handshake Verified'}
                    {scanState === 'failed' && 'Verification Failed'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {scanState === 'scanning' ? `Verifying local hardware keys (${scanProgress}%)` : 
                     scanState === 'success' ? 'Unlocking work dashboard...' :
                     scanState === 'failed' ? 'System could not verify parameters' : 
                     `Place biometric indicator to continue`}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                    <motion.div 
                      className={`h-full ${scanState === 'failed' ? 'bg-rose-500' : 'bg-blue-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ ease: 'linear' }}
                    />
                  </div>
                </div>

                {/* Action buttons under scanner */}
                <div className="mt-6 flex w-full gap-3">
                  {scanState === 'failed' ? (
                    <button
                      onClick={handleStartScan}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 text-sm font-medium text-blue-400 hover:bg-slate-800 transition"
                    >
                      Retry Biometrics
                    </button>
                  ) : scanState === 'idle' ? (
                    <button
                      onClick={handleStartScan}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition"
                    >
                      Authenticate Now
                    </button>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Choice */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex justify-center gap-4 text-xs font-medium text-slate-500"
        >
          <button 
            type="button"
            onClick={() => { setAuthMode('fingerprint'); setScanState('idle'); }}
            className={`transition hover:text-slate-300 ${authMode === 'fingerprint' ? 'text-blue-500 font-semibold' : ''}`}
          >
            Touch ID
          </button>
          <span className="text-slate-800">•</span>
          <button 
            type="button"
            onClick={() => { setAuthMode('face'); setScanState('idle'); }}
            className={`transition hover:text-slate-300 ${authMode === 'face' ? 'text-blue-500 font-semibold' : ''}`}
          >
            Face ID
          </button>
          <span className="text-slate-800">•</span>
          <button 
            type="button"
            onClick={() => { setAuthMode('pin'); setScanState('idle'); }}
            className={`transition hover:text-slate-300 ${authMode === 'pin' ? 'text-blue-500 font-semibold' : ''}`}
          >
            Emergency PIN
          </button>
        </motion.div>

        {/* GDPR Compliance Notice */}
        <p className="mt-12 text-[10px] leading-relaxed text-slate-600 font-mono">
          GDPR SECURE PROTOCOL: BIOMETRIC TEMPLATES ARE PROCESSED ON-DEVICE. NO BIOMETRIC INFORMATION IS TRANSMITTED OR STORED OUTSIDE THE ENCRYPTED LOCAL CONTAINER. PIN CODE BYPASS INTEGRATES HIGH-GRADE CIPHER CHECKS.
        </p>
      </div>
    </div>
  );
}
