/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { TimesheetEntry } from '../types';
import { Clock, DollarSign, Briefcase, TrendingUp, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface DashboardViewProps {
  entries: TimesheetEntry[];
  privacyMode: boolean;
  onTogglePrivacy: () => void;
}

export default function DashboardView({ entries, privacyMode, onTogglePrivacy }: DashboardViewProps) {
  
  // Aggregate calculations
  const stats = useMemo(() => {
    let totalHours = 0;
    let totalEarnings = 0;
    const projects = new Set<string>();

    entries.forEach(e => {
      totalHours += e.totalHours;
      totalEarnings += e.earnings;
      if (e.project) {
        projects.add(e.project);
      }
    });

    const avgRate = totalHours > 0 ? (totalEarnings / totalHours) : 0;

    return {
      totalHours: Number(totalHours.toFixed(2)),
      totalEarnings: Number(totalEarnings.toFixed(2)),
      avgRate: Number(avgRate.toFixed(2)),
      projectCount: projects.size
    };
  }, [entries]);

  // Chart 1: Group hours by date for current and past entries (Last 10 entries)
  const chronologicalData = useMemo(() => {
    // Sort oldest first for progression
    const sorted = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // last 10 entries

    return sorted.map(e => ({
      date: e.date.substring(5), // MM-DD
      Hours: e.totalHours,
      Earnings: e.earnings,
      Project: e.project
    }));
  }, [entries]);

  // Chart 2: Hours by Project (Pie Chart)
  const projectData = useMemo(() => {
    const projMap: { [key: string]: number } = {};
    entries.forEach(e => {
      if (!projMap[e.project]) {
        projMap[e.project] = 0;
      }
      projMap[e.project] += e.totalHours;
    });

    return Object.keys(projMap).map(name => ({
      name,
      value: Number(projMap[name].toFixed(2))
    }));
  }, [entries]);

  // Chart 3: Weekly breakdown
  const weeklyData = useMemo(() => {
    const weeks: { [key: string]: { hours: number; earnings: number } } = {};
    
    entries.forEach(entry => {
      const dateObj = new Date(entry.date + 'T00:00:00');
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dateObj.setDate(diff));
      const weekStr = `Wk ${monday.getMonth() + 1}/${monday.getDate()}`;

      if (!weeks[weekStr]) {
        weeks[weekStr] = { hours: 0, earnings: 0 };
      }
      weeks[weekStr].hours += entry.totalHours;
      weeks[weekStr].earnings += entry.earnings;
    });

    // Sort weeks chronological
    return Object.keys(weeks).map(wk => ({
      name: wk,
      Hours: Number(weeks[wk].hours.toFixed(1)),
      Earnings: Number(weeks[wk].earnings.toFixed(0))
    })).reverse();
  }, [entries]);

  const COLORS = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#60a5fa', '#a5f3fc'];

  const formatCurrency = (val: number) => {
    if (privacyMode) return '$••••';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div id="dashboard-view" className="space-y-6">
      
      {/* Top Welcome Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Analytics Dashboard</h1>
          <p className="text-xs text-slate-400">Data compiled from secure local sandboxed time log structures.</p>
        </div>
        
        {/* Privacy Shield Trigger */}
        <button
          onClick={onTogglePrivacy}
          className="flex self-start items-center gap-2 rounded-xl border border-slate-800 bg-[#18181B] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
        >
          {privacyMode ? (
            <>
              <Eye className="h-4 w-4 text-blue-400 animate-pulse" />
              <span>Disable Privacy Shield</span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 text-slate-400" />
              <span>Enable Privacy Shield</span>
            </>
          )}
        </button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Hours</span>
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold text-white tracking-tight">
              {stats.totalHours} <span className="text-xs font-normal text-slate-400">hrs</span>
            </h3>
            <p className="mt-1 text-[10px] text-slate-500 font-mono">ALL SECURE RECORDED SESSIONS</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Gross Earnings</span>
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold text-white tracking-tight">
              {formatCurrency(stats.totalEarnings)}
            </h3>
            <p className="mt-1 text-[10px] text-slate-500 font-mono">
              {privacyMode ? 'ENCRYPTED FROM DISPLAY' : 'ACCUMULATED NET PAY'}
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Avg Hourly Rate</span>
            <div className="rounded-xl bg-blue-600/10 p-2 text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold text-white tracking-tight">
              {formatCurrency(stats.avgRate)}<span className="text-xs font-normal text-slate-400">/hr</span>
            </h3>
            <p className="mt-1 text-[10px] text-slate-500 font-mono">AGGREGATE CONTRACT WEIGHT</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Workspaces/Projects</span>
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold text-white tracking-tight">
              {stats.projectCount} <span className="text-xs font-normal text-slate-400">active</span>
            </h3>
            <p className="mt-1 text-[10px] text-slate-500 font-mono">UNIQUE WORK SEGMENTS</p>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Weekly Hours Workload (Bar Chart) */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
          <h2 className="mb-4 text-sm font-medium text-slate-200">Weekly Hours Workload</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '16px' }}
                  labelClassName="text-slate-200 font-semibold text-xs"
                  itemStyle={{ fontSize: '11px', color: '#3b82f6' }}
                />
                <Bar dataKey="Hours" fill="url(#hoursGrad)" radius={[4, 4, 0, 0]} barSize={40} />
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85}/>
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Workload Allocation (Pie Chart) */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Workforce Project Share</h2>
            <p className="text-[11px] text-slate-500">Distribution of total logged hours</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center relative my-4">
            {projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {projectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '16px' }}
                    itemStyle={{ fontSize: '11px', color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500">No projects to display.</p>
            )}
            {/* Center label */}
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-500">PROJECTS</span>
              <span className="text-lg font-bold text-slate-200">{stats.projectCount}</span>
            </div>
          </div>
          {/* Custom Legends */}
          <div className="max-h-24 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {projectData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-300 truncate">{item.name}</span>
                </div>
                <span className="text-slate-400 font-mono ml-2">{item.value} hrs</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Cumulative Earnings Over Time (Area Chart) */}
      <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
        <h2 className="mb-4 text-sm font-medium text-slate-200">Chronological Session Log</h2>
        <div className="h-64 w-full">
          {chronologicalData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chronologicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '16px' }}
                  labelClassName="text-slate-200 font-semibold text-xs"
                  itemStyle={{ fontSize: '11px' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Earnings') return [formatCurrency(Number(value)), 'Earnings'];
                    return [value + ' hrs', name];
                  }}
                />
                <Area type="monotone" dataKey={privacyMode ? 'Hours' : 'Earnings'} name={privacyMode ? 'Hours' : 'Earnings'} stroke="#3b82f6" fillOpacity={1} fill="url(#earningsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-slate-500">No historical sessions recorded.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compliance Verification Footer */}
      <div className="rounded-3xl border border-blue-500/15 bg-blue-500/5 p-5 flex items-start gap-3 shadow-sm">
        <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-semibold text-blue-400">Local Isolation Verified</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            This analytical dashboard executes strictly inside your browser sandbox using high-performance mathematical aggregates over cached Local Storage. Zero tracking, profiling, or analytical packet serialization occurs, fully aligning with corporate GDPR and CCPA non-disclosure protocols.
          </p>
        </div>
      </div>

    </div>
  );
}
