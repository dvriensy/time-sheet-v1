/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudLightning, RefreshCw, Users, ShieldCheck, CheckCircle2, Server, HelpCircle } from 'lucide-react';
import { getSyncSettings, saveSyncSettings, addSecurityLog } from '../utils/storage';
import { MOCK_TEAM_MEMBERS } from '../data/mockData';
import { SyncSettings, TeamMember } from '../types';

interface CollaborationHubProps {
  onSyncComplete: () => void;
}

export default function CollaborationHub({ onSyncComplete }: CollaborationHubProps) {
  const initialSync = useMemo(() => getSyncSettings(), []);
  
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(initialSync);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [syncCount, setSyncCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(MOCK_TEAM_MEMBERS);

  // Auto trigger members status updates mimicking a real web-socket sync
  useEffect(() => {
    const interval = setInterval(() => {
      setTeamMembers((prev) => {
        return prev.map(member => {
          // 15% chance a member changes their state to look alive/synced!
          if (Math.random() < 0.15) {
            const states: TeamMember['status'][] = ['clocked_in', 'on_break', 'clocked_out'];
            const nextStatus = states[Math.floor(Math.random() * states.length)];
            const activeProjects = ['Acme Redesign', 'Cloud Migration', 'Internal Tools', 'Database Migration'];
            return {
              ...member,
              status: nextStatus,
              currentProject: nextStatus !== 'clocked_out' ? activeProjects[Math.floor(Math.random() * activeProjects.length)] : undefined,
              lastActive: new Date().toISOString()
            };
          }
          return member;
        });
      });
    }, 15000); // check every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const handleToggleSync = (enabled: boolean) => {
    const updated = { ...syncSettings, enabled };
    setSyncSettings(updated);
    saveSyncSettings(updated);
  };

  const handleSaveTextSettings = (updates: Partial<SyncSettings>) => {
    const updated = { ...syncSettings, ...updates };
    setSyncSettings(updated);
    saveSyncSettings(updated);
  };

  const handleForceSync = () => {
    setSyncState('syncing');
    setSyncCount(prev => prev + 1);

    setTimeout(() => {
      setSyncState('success');
      const now = new Date().toISOString();
      const updated = { ...syncSettings, lastSyncTime: now };
      setSyncSettings(updated);
      saveSyncSettings(updated);
      
      addSecurityLog(
        'Sync status changed',
        `Secure handshake sync complete. Synced with Workspace: "${syncSettings.workspaceName || 'Unregistered'}". Local ledger aligned with remote nodes.`,
        'sync'
      );
      
      onSyncComplete();

      setTimeout(() => {
        setSyncState('idle');
      }, 3500);
    }, 2500); // 2.5 seconds sync roundtrip latency
  };

  const formatLastSync = (iso: string) => {
    if (!iso) return 'Never Synced';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' on ' + d.toLocaleDateString();
  };

  return (
    <div id="collaboration-hub" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      
      {/* COWORKERS COLLABORATION STATUS BOARD */}
      <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span>Real-Time Team Workstation Board</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Synced Outpost Members</span>
          </div>
          <p className="text-xs text-slate-400">Review coworkers logged in to shared workspaces across geofenced nodes.</p>
        </div>

        {/* Members Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {teamMembers.map((member) => (
            <div key={member.id} className="rounded-2xl border border-slate-800/60 bg-zinc-950/40 p-4 flex items-center justify-between gap-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                {/* Avatar Initials Placeholder */}
                <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
                  {member.name.split(' ').map(n=>n[0]).join('')}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{member.name}</h4>
                  {member.status === 'clocked_out' ? (
                    <p className="text-[10px] text-slate-500 font-mono">Offline</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                      Working on: <strong className="text-slate-300">{member.currentProject}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  member.status === 'clocked_in' ? 'bg-blue-500/10 text-blue-400' :
                  member.status === 'on_break' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    member.status === 'clocked_in' ? 'bg-blue-400 animate-pulse' :
                    member.status === 'on_break' ? 'bg-amber-400' : 'bg-slate-600'
                  }`} />
                  {member.status === 'clocked_in' ? 'Shift Active' :
                   member.status === 'on_break' ? 'On Break' : 'Offline'}
                </span>
                <p className="text-[9px] text-slate-600 font-mono mt-1">
                  Active {new Date(member.lastActive).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Realtime Socket Sync Status Bar */}
        <div className="rounded-xl bg-zinc-950/80 border border-slate-800 p-3 flex justify-between items-center text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            <span>SOCKET CHANNEL: #COLLAB-WS-ACTIVE</span>
          </div>
          <div>
            <span>REFRESH CADENCE: 15S METADATA PUSH</span>
          </div>
        </div>

      </div>

      {/* SYNC CONTROLLERS & WORKSPACE PARAMETERS */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Sync Controls card */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl flex flex-col justify-between">
          
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
              <Cloud className="h-4 w-4 text-blue-400" />
              <span>Team Sync Preferences</span>
            </h3>

            <div className="space-y-4">
              
              {/* Toggle Sync Enabled */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Cloud Synchronization</h4>
                  <p className="text-[10px] text-slate-400">Upload to multi-user server node</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={syncSettings.enabled} 
                    onChange={(e) => handleToggleSync(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
                </label>
              </div>

              {/* Org ID */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Organization ID</label>
                <input
                  type="text"
                  placeholder="e.g. ORG-DESIGN-TECH-500"
                  disabled={!syncSettings.enabled}
                  value={syncSettings.orgId}
                  onChange={(e) => handleSaveTextSettings({ orgId: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-700 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Workspace Name */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Workspace Node Name</label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco HQ"
                  disabled={!syncSettings.enabled}
                  value={syncSettings.workspaceName}
                  onChange={(e) => handleSaveTextSettings({ workspaceName: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-700 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Conflict resolution policy */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Conflict Policy</label>
                <select
                  disabled={!syncSettings.enabled}
                  value={syncSettings.conflictPolicy}
                  onChange={(e) => handleSaveTextSettings({ conflictPolicy: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="client_wins">Client wins (Local state master)</option>
                  <option value="server_wins">Server wins (Relational state master)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Sync Button & Info block */}
          {syncSettings.enabled && (
            <div className="mt-6 pt-5 border-t border-slate-800/60 space-y-4">
              
              {/* Force sync button */}
              <button
                onClick={handleForceSync}
                disabled={syncState === 'syncing'}
                className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/10 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                <span>
                  {syncState === 'syncing' ? 'Publishing timesheet nodes...' : 'Sync Workspace Data'}
                </span>
              </button>

              <AnimatePresence mode="wait">
                {syncState === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[11px] font-semibold text-blue-400">Handshake Complete</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Database tables converged successfully. Broadcasted local segments to Org Node.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Last synced timestamp display */}
              <div className="text-center font-mono text-[9px] text-slate-500">
                LAST HANDSHAKE: <strong>{formatLastSync(syncSettings.lastSyncTime)}</strong>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
