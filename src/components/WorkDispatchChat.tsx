/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Briefcase, Plus, CheckCircle, Trash2, Clock, 
  Shield, Send, Sparkles, X, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { 
  getWorkDispatches, 
  addWorkDispatch, 
  addDispatchReply, 
  toggleCloseWorkDispatch, 
  deleteWorkDispatch,
  UserAccount
} from '../utils/storage';
import { WorkDispatch } from '../types';

interface WorkDispatchChatProps {
  currentUser: UserAccount;
}

export default function WorkDispatchChat({ currentUser }: WorkDispatchChatProps) {
  const [dispatches, setDispatches] = useState<WorkDispatch[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New dispatch form state
  const [title, setTitle] = useState('');
  const [shiftDetails, setShiftDetails] = useState('');
  const [description, setDescription] = useState('');
  const [rateBonus, setRateBonus] = useState('');
  
  // Replies input state (mapped by dispatchId)
  const [replyMessages, setReplyMessages] = useState<Record<string, string>>({});
  const [replyAvailable, setReplyAvailable] = useState<Record<string, boolean>>({});
  
  // Expanded dispatches for replies
  const [expandedDispatches, setExpandedDispatches] = useState<Record<string, boolean>>({});

  const isManager = currentUser.role === 'manager' || currentUser.username === 'derek_vriens' || currentUser.fullName.toLowerCase() === 'derek vriens' || currentUser.email?.toLowerCase() === 'dvriensy@gmail.com';

  const loadData = () => {
    const list = getWorkDispatches();
    setDispatches(list);
  };

  useEffect(() => {
    loadData();
    // Listen to real-time storage-sync updates (Firestore updates write to localStorage and dispatch this event)
    window.addEventListener('storage-sync', loadData);
    return () => {
      window.removeEventListener('storage-sync', loadData);
    };
  }, []);

  const handleCreateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !shiftDetails.trim() || !description.trim()) return;

    addWorkDispatch(title, shiftDetails, description, rateBonus);
    
    // Reset form
    setTitle('');
    setShiftDetails('');
    setDescription('');
    setRateBonus('');
    setShowAddForm(false);
    loadData();
  };

  const handleSendReply = (dispatchId: string) => {
    const message = replyMessages[dispatchId] || '';
    if (!message.trim()) return;

    const available = !!replyAvailable[dispatchId];
    addDispatchReply(dispatchId, message, available);

    // Reset reply inputs
    setReplyMessages(prev => ({ ...prev, [dispatchId]: '' }));
    setReplyAvailable(prev => ({ ...prev, [dispatchId]: false }));
    loadData();
  };

  const handleToggleClose = (id: string) => {
    toggleCloseWorkDispatch(id);
    loadData();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this work dispatch post?')) {
      deleteWorkDispatch(id);
      loadData();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDispatches(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div id="work-dispatch-chat" className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header section with actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card-bg/60 border border-main-border/50 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-main-text flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-500 animate-pulse" />
            <span>Work Dispatch & Chat Hub</span>
          </h2>
          <p className="text-xs text-muted-text mt-0.5 font-mono">
            Coordinate shifts, request extra help, and log real-time availability.
          </p>
        </div>

        {isManager && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer shadow-md transition duration-200"
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{showAddForm ? 'Cancel Post' : 'Post Extra Work'}</span>
          </button>
        )}
      </div>

      {/* Add New Dispatch Form (Managers Only) */}
      <AnimatePresence>
        {showAddForm && isManager && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-card-bg border border-main-border rounded-2xl p-5 shadow-lg space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-main-border/40">
              <Shield className="h-4 w-4 text-blue-500" />
              <h3 className="text-xs font-bold text-main-text uppercase tracking-wider font-mono">
                Create Extra Work Proposal
              </h3>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-text uppercase font-mono block">
                    Job Title / Role Needed
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Warehouse Coverage / Delivery Support"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-3 text-xs text-main-text focus:border-blue-500/45 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-text uppercase font-mono block">
                    Shift Details (Date & Time)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saturday, July 18, 9:00 AM - 5:00 PM"
                    value={shiftDetails}
                    onChange={(e) => setShiftDetails(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-3 text-xs text-main-text focus:border-blue-500/45 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-text uppercase font-mono block">
                    Shift Requirements & Details
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details about the work, what to expect, and tools/materials needed..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-3 text-xs text-main-text placeholder-muted-text/30 focus:border-blue-500/45 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-text uppercase font-mono block">
                    Rate Multiplier / Special Bonus (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1.5x Overtime Rate / $50 Flat Bonus"
                    value={rateBonus}
                    onChange={(e) => setRateBonus(e.target.value)}
                    className="w-full rounded-xl border border-main-border bg-input-bg p-3 text-xs text-main-text focus:border-blue-500/45 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition shadow"
                >
                  Post Dispatch Shift
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispatches List */}
      <div className="space-y-4">
        {dispatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card-bg/30 border border-dashed border-main-border rounded-2xl text-center">
            <Briefcase className="h-8 w-8 text-muted-text/40 mb-3" />
            <h4 className="text-sm font-bold text-main-text">No Extra Work Dispatches Posted</h4>
            <p className="text-xs text-muted-text max-w-md mt-1">
              Managers can use the button above to publish open shifts and extra assignments for the team to claim.
            </p>
          </div>
        ) : (
          dispatches.map((disp) => {
            const hasReplies = disp.replies.length > 0;
            const isExpanded = !!expandedDispatches[disp.id];
            const availableResponders = disp.replies.filter(r => r.isAvailableToWork);
            const isAuthor = disp.managerUsername === currentUser.username;

            return (
              <div 
                key={disp.id} 
                className={`bg-card-bg border transition-all duration-200 rounded-2xl overflow-hidden ${
                  disp.isClosed 
                    ? 'border-main-border/30 opacity-70' 
                    : 'border-main-border hover:border-main-border/80 shadow-md'
                }`}
              >
                {/* Post Header Card */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold font-mono uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded">
                          EXTRA WORK
                        </span>
                        {disp.rateBonus && (
                          <span className="text-[9px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            {disp.rateBonus}
                          </span>
                        )}
                        {disp.isClosed && (
                          <span className="text-[9px] font-bold font-mono uppercase bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded">
                            FILLED / CLOSED
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-main-text">{disp.title}</h3>
                    </div>

                    {isManager && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleClose(disp.id)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition ${
                            disp.isClosed 
                              ? 'bg-blue-600/15 hover:bg-blue-600/30 text-blue-500' 
                              : 'bg-amber-600/15 hover:bg-amber-600/30 text-amber-500'
                          }`}
                          title={disp.isClosed ? 'Reopen post' : 'Mark as Filled/Closed'}
                        >
                          {disp.isClosed ? 'Reopen' : 'Close Post'}
                        </button>
                        {isAuthor && (
                          <button
                            onClick={() => handleDelete(disp.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
                            title="Delete post"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-app-bg/50 p-3 rounded-xl border border-main-border/30">
                    <div className="flex items-center gap-2 text-muted-text">
                      <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <div>
                        <span className="text-[10px] font-mono uppercase block text-muted-text/60 leading-none mb-0.5">Shift Hours</span>
                        <strong className="text-main-text font-medium">{disp.shiftDetails}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-text border-t sm:border-t-0 sm:border-l border-main-border/40 pt-2 sm:pt-0 sm:pl-3">
                      <Shield className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <div>
                        <span className="text-[10px] font-mono uppercase block text-muted-text/60 leading-none mb-0.5">Posted By</span>
                        <span className="text-main-text">{disp.managerName}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-main-text leading-relaxed whitespace-pre-wrap">{disp.description}</p>

                  {/* Available Responders summary */}
                  {availableResponders.length > 0 && (
                    <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase font-mono">
                          {availableResponders.length} Team Members Available to Work:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {availableResponders.map((resp, idx) => (
                          <span 
                            key={idx} 
                            className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          >
                            {resp.fullName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions / Toggle Replies */}
                  <div className="flex items-center justify-between border-t border-main-border/40 pt-3">
                    <button
                      onClick={() => toggleExpand(disp.id)}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-bold transition cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{disp.replies.length} {disp.replies.length === 1 ? 'Reply' : 'Replies'}</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    <span className="text-[10px] text-muted-text font-mono">
                      {new Date(disp.createdAt).toLocaleDateString()} {new Date(disp.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>

                {/* Replies drawer section */}
                {isExpanded && (
                  <div className="border-t border-main-border/60 bg-app-bg/30 p-4 space-y-4">
                    {/* List of Replies */}
                    {hasReplies && (
                      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                        {disp.replies.map((reply) => {
                          const isReplierAvailable = reply.isAvailableToWork;
                          return (
                            <div 
                              key={reply.id} 
                              className={`p-3 rounded-xl border transition-colors ${
                                isReplierAvailable 
                                  ? 'bg-emerald-500/[0.02] border-emerald-500/30' 
                                  : 'bg-card-bg/60 border-main-border/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-1">
                                <div className="flex items-center gap-2">
                                  {reply.avatarUrl ? (
                                    <img 
                                      src={reply.avatarUrl} 
                                      alt={reply.fullName} 
                                      referrerPolicy="no-referrer"
                                      className="w-5 h-5 rounded-full object-cover" 
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 text-[10px] font-bold">
                                      {reply.fullName.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-xs font-bold text-main-text">
                                    {reply.fullName}
                                  </span>
                                  {reply.username === disp.managerUsername && (
                                    <span className="text-[8px] font-bold font-mono bg-blue-500/10 text-blue-500 px-1 rounded">
                                      MANAGER
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isReplierAvailable && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                      <CheckCircle className="h-2 w-2" />
                                      AVAILABLE
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono text-muted-text">
                                    {new Date(reply.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-main-text leading-relaxed pl-7">{reply.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Submit Reply Input Form */}
                    {!disp.isClosed ? (
                      <div className="space-y-2 pt-2 border-t border-main-border/30">
                        <div className="flex flex-row items-center gap-3">
                          <input
                            type="text"
                            placeholder="Type a reply..."
                            value={replyMessages[disp.id] || ''}
                            onChange={(e) => setReplyMessages(prev => ({ ...prev, [disp.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendReply(disp.id);
                            }}
                            className="flex-1 rounded-xl border border-main-border bg-input-bg px-3 py-2 text-xs text-main-text focus:border-blue-500/40 focus:outline-none transition-colors"
                          />

                          <button
                            onClick={() => handleSendReply(disp.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl cursor-pointer transition shadow"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Availability Toggle button */}
                        <div className="flex items-center gap-2 pl-1">
                          <label className="relative flex items-center gap-1.5 cursor-pointer text-[11px] font-mono font-medium text-muted-text select-none">
                            <input
                              type="checkbox"
                              checked={!!replyAvailable[disp.id]}
                              onChange={(e) => setReplyAvailable(prev => ({ ...prev, [disp.id]: e.target.checked }))}
                              className="accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                            />
                            <span>Flag myself as <strong className="text-emerald-500">AVAILABLE TO WORK</strong> for this shift</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/15 rounded-xl text-red-400 text-xs justify-center">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>This work dispatch is closed. New replies are disabled.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
