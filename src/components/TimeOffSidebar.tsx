/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Send, X, 
  HelpCircle, Bell, ChevronLeft, CalendarDays, FileText, MessageSquare
} from 'lucide-react';
import { 
  getTimeOffRequests, 
  addTimeOffRequest, 
  acknowledgeTimeOffResponse, 
  TimeOffRequest,
  UserAccount
} from '../utils/storage';

interface TimeOffSidebarProps {
  currentUser: UserAccount;
  isOpen: boolean;
  onClose: () => void;
  onNewRequestSubmitted?: () => void;
}

export default function TimeOffSidebar({ 
  currentUser, 
  isOpen, 
  onClose,
  onNewRequestSubmitted 
}: TimeOffSidebarProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isManager = currentUser.role === 'manager' || currentUser.username === 'derek_vriens' || currentUser.fullName.toLowerCase() === 'derek vriens' || currentUser.email?.toLowerCase() === 'dvriensy@gmail.com';

  // Load requests for current user
  const loadRequests = () => {
    const all = getTimeOffRequests();
    // Non-managers only see their own requests
    if (isManager) {
      setRequests(all);
    } else {
      setRequests(all.filter(r => r.username === currentUser.username));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!startDate || !endDate || !reason.trim()) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setErrorMessage('Start date cannot be after end date.');
      return;
    }

    const req = addTimeOffRequest(startDate, endDate, reason);
    if (req) {
      setSuccessMessage('Time off request submitted successfully to Derek Vriens.');
      setStartDate('');
      setEndDate('');
      setReason('');
      loadRequests();
      if (onNewRequestSubmitted) {
        onNewRequestSubmitted();
      }
    } else {
      setErrorMessage('Failed to submit request. Please try again.');
    }
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeTimeOffResponse(id);
    loadRequests();
    if (onNewRequestSubmitted) {
      onNewRequestSubmitted();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs"
          />

          {/* Sidebar drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-card-bg border-l border-main-border shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-main-border/80 flex items-center justify-between bg-app-bg/50">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold text-main-text leading-tight">Request Time Off</h3>
                  <p className="text-[10px] text-muted-text font-mono">Ledger Administrative Portal</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl border border-main-border hover:bg-main-border/20 text-muted-text hover:text-main-text transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Request Form (for anyone submitting) */}
              <div className="bg-app-bg/40 border border-main-border/60 rounded-2xl p-4.5 space-y-4">
                <h4 className="text-xs font-bold text-main-text uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-blue-500" />
                  New Absence Proposal
                </h4>

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase font-mono block mb-1 text-muted-text">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase font-mono block mb-1 text-muted-text">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase font-mono block mb-1 text-muted-text">Reason / Comments</label>
                    <textarea
                      rows={2}
                      placeholder="Specify reason for medical leave, vacation, or custom hours adjustment..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-main-border bg-input-bg p-2.5 text-xs text-main-text placeholder-muted-text/30 focus:border-blue-500/40 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="font-semibold">{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="font-semibold">{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Request</span>
                  </button>
                </form>
              </div>

              {/* Request List and status reports */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-text uppercase tracking-wider font-mono">
                    {isManager ? "All Employee Time-Off Requests" : "Your Absence Ledger Logs"}
                  </h4>
                  <span className="text-[10px] font-mono text-muted-text">
                    {requests.length} records
                  </span>
                </div>

                <div className="space-y-3.5">
                  {requests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isDenied = req.status === 'denied';

                    // Warning: Manager has not responded
                    const hasPassedTime = (Date.now() - new Date(req.createdAt).getTime()) > 30000; // unacknowledged time (e.g. 30s for demo, but normally hours/days)
                    const isUnacknowledged = isPending && hasPassedTime;

                    return (
                      <div 
                        key={req.id} 
                        className={`border rounded-2xl p-4 space-y-3 shadow-md relative transition-all duration-200 ${
                          isApproved 
                            ? 'border-emerald-500/30 bg-emerald-500/[0.02]' 
                            : isDenied 
                            ? 'border-red-500/30 bg-red-500/[0.02]' 
                            : isUnacknowledged
                            ? 'border-amber-500/40 bg-amber-500/[0.02] animate-pulse'
                            : 'border-main-border'
                        }`}
                      >
                        {/* Header metadata */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-text font-mono uppercase block">Date Span</span>
                            <span className="text-xs font-bold text-main-text">
                              {new Date(req.startDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                              {" – "}
                              {new Date(req.endDate + 'T00:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                            </span>
                          </div>

                          {/* Status indicator pills */}
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                              <CheckCircle className="h-2.5 w-2.5" />
                              Approved
                            </span>
                          ) : isDenied ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-500 border border-red-500/20 uppercase tracking-wider">
                              <XCircle className="h-2.5 w-2.5" />
                              Denied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                              <Clock className="h-2.5 w-2.5" />
                              Pending
                            </span>
                          )}
                        </div>

                        {/* Reason block */}
                        <div className="bg-app-bg/50 p-2.5 rounded-xl border border-main-border/30 text-left">
                          {isManager && (
                            <span className="text-[9px] font-mono text-blue-500 font-semibold block mb-0.5">Requester: {req.fullName} (@{req.username})</span>
                          )}
                          <span className="text-[9px] text-muted-text uppercase font-mono block">Submission Memo</span>
                          <p className="text-xs text-main-text italic leading-relaxed">"{req.reason}"</p>
                        </div>

                        {/* Unacknowledged Alert Notification */}
                        {isPending && (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-amber-500 uppercase font-mono block">Unacknowledged Alert</span>
                              <p className="text-[10px] text-muted-text leading-snug">Management (Derek Vriens) has not reviewed this yet. Standard audit SLA response is pending.</p>
                            </div>
                          </div>
                        )}

                        {/* Manager response feedback block */}
                        {(req.managerNotes || req.respondedAt) && (
                          <div className="bg-blue-500/[0.03] border border-blue-500/10 rounded-xl p-2.5 text-left space-y-1">
                            <span className="text-[9px] text-blue-500 font-bold uppercase font-mono block">Management Decision Note</span>
                            <p className="text-xs text-muted-text leading-relaxed">
                              {req.managerNotes ? `"${req.managerNotes}"` : "Decision filed without comments."}
                            </p>
                            {req.respondedAt && (
                              <span className="text-[9px] font-mono text-muted-text block">
                                Filed at: {new Date(req.respondedAt).toLocaleDateString()} {new Date(req.respondedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Requester acknowledgment banner notification */}
                        {!isManager && !req.acknowledgedByRequester && !isPending && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-blue-500 shrink-0 animate-bounce" />
                              <span className="text-[10px] font-bold text-blue-400">Decision Issued!</span>
                            </div>
                            <button
                              onClick={() => handleAcknowledge(req.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black px-2 py-1 rounded-md cursor-pointer transition uppercase"
                            >
                              Dismiss Alert
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })}

                  {requests.length === 0 && (
                    <div className="bg-app-bg/25 border border-main-border/50 rounded-2xl py-8 text-center text-muted-text">
                      <Calendar className="h-7 w-7 text-muted-text/30 mx-auto mb-2" />
                      <p className="text-xs font-semibold">No time off records logged</p>
                      <p className="text-[10px] mt-1">Absence approvals and historical proposals will map here.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Compliance Banner */}
            <div className="p-4 bg-app-bg/70 border-t border-main-border/70 text-center">
              <span className="text-[9px] font-mono text-muted-text leading-tight block">
                Absence approvals are tracked, audited, and mirrored in local compliance registers.
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
