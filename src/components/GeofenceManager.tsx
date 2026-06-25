/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin, Navigation, Compass, Radio, BellRing, Settings2, Sliders } from 'lucide-react';
import { getGeofenceSettings, saveGeofenceSettings, addSecurityLog } from '../utils/storage';
import { GeofenceSettings } from '../types';

interface GeofenceManagerProps {
  onGeofenceStateChange: (inside: boolean, name: string) => void;
  onSimulatedTrigger: (inside: boolean) => void;
}

export default function GeofenceManager({ onGeofenceStateChange, onSimulatedTrigger }: GeofenceManagerProps) {
  const initialSettings = useMemo(() => getGeofenceSettings(), []);
  
  const [settings, setSettings] = useState<GeofenceSettings>(initialSettings);
  const [currentDistance, setCurrentDistance] = useState(240); // Initial simulated distance (meters)
  const [userPos, setUserPos] = useState({ x: 120, y: 70 }); // Screen projection of user dot on the SVG radar map
  const [isSimulatingInside, setIsSimulatingInside] = useState(false);
  const [actualLocationStatus, setActualLocationStatus] = useState<string>('Idle');

  const geofenceRadiusPixels = useMemo(() => {
    // Map radius in meters (50m to 500m) to pixels on a 300x300 SVG canvas
    return Math.max(30, Math.min(130, (settings.radius / 500) * 120));
  }, [settings.radius]);

  // Handle saving geofence properties
  const handleSaveSettings = (updates: Partial<GeofenceSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveGeofenceSettings(updated);
  };

  // Run Simulated state changes based on distance
  useEffect(() => {
    const isInside = currentDistance <= settings.radius;
    setIsSimulatingInside(isInside);
    onGeofenceStateChange(isInside, settings.name);
    
    // Trigger automatic reminds or clock checks
    if (isInside && settings.autoClockIn) {
      onSimulatedTrigger(true);
    } else if (!isInside && settings.autoClockOut) {
      onSimulatedTrigger(false);
    }
  }, [currentDistance, settings.radius, settings.autoClockIn, settings.autoClockOut]);

  // Request actual Geolocation coordinates (optional user-consent feature)
  const handleRequestActualGPS = () => {
    if (!navigator.geolocation) {
      setActualLocationStatus('Geolocation not supported by client iframe.');
      return;
    }
    
    setActualLocationStatus('Querying browser satellite sensors...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setActualLocationStatus(`Success: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] ±${accuracy.toFixed(0)}m`);
        
        // Match settings to actual coordinates
        handleSaveSettings({ latitude, longitude });
        addSecurityLog(
          'GPS tracking geofence breached',
          `GPS telemetry matches actual user coordinates [${latitude}, ${longitude}] with ${accuracy}m confidence.`,
          'geofence'
        );
      },
      (error) => {
        setActualLocationStatus(`Satellite lookup rejected: ${error.message}`);
      }
    );
  };

  // Convert click coordinates on the SVG canvas to a simulated distance
  const handleRadarClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Center is at 150, 150
    const dx = x - 150;
    const dy = y - 150;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    
    // Map pixels back to meters: (distPx / geofenceRadiusPixels) * settings.radius
    const distMeters = Math.round((distPx / geofenceRadiusPixels) * settings.radius);
    
    setUserPos({ x, y });
    setCurrentDistance(distMeters);

    addSecurityLog(
      'GPS tracking geofence breached',
      `Manual simulation coordinate altered. Radial distance from center: ${distMeters}m (${distMeters <= settings.radius ? 'INSIDE' : 'OUTSIDE'} geofence)`,
      'geofence'
    );
  };

  // Quick state preset buttons
  const setSimulatedPreset = (preset: 'inside' | 'outside') => {
    if (preset === 'inside') {
      setUserPos({ x: 150 + Math.random() * 20 - 10, y: 150 + Math.random() * 20 - 10 });
      setCurrentDistance(Math.round(settings.radius * 0.4));
    } else {
      setUserPos({ x: 50, y: 50 });
      setCurrentDistance(Math.round(settings.radius * 1.8));
    }
  };

  return (
    <div id="geofence-manager" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      
      {/* RADAR CHART VISUALIZER */}
      <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Compass className="h-4 w-4 text-blue-400 animate-pulse" />
              <span>Geofencing Boundary Radar</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-500 uppercase">GPS CLOCK-IN GATEWAY</span>
          </div>
          <p className="text-xs text-slate-400">Click anywhere on the radar scanner grid to simulate moving your location.</p>
        </div>

        {/* Dynamic SVG Radar Map */}
        <div className="flex justify-center items-center my-6 relative bg-zinc-950/80 rounded-2xl border border-slate-800 p-4 overflow-hidden shadow-inner">
          {/* Radial Sweep Scanner Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-500/5 to-transparent pointer-events-none animate-spin" style={{ animationDuration: '6s' }} />
          
          <svg 
            width="280" 
            height="280" 
            viewBox="0 0 300 300" 
            onClick={handleRadarClick}
            className="cursor-crosshair relative z-10 select-none"
          >
            {/* Radar Circular Gridlines */}
            <circle cx="150" cy="150" r="140" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="150" cy="150" r="100" fill="none" stroke="#1e293b" strokeWidth="1" />
            <circle cx="150" cy="150" r="60" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="150" cy="150" r="20" fill="none" stroke="#1e293b" strokeWidth="1" />
            
            {/* Axis gridlines */}
            <line x1="10" y1="150" x2="290" y2="150" stroke="#1e293b" strokeWidth="0.5" />
            <line x1="150" y1="10" x2="150" y2="290" stroke="#1e293b" strokeWidth="0.5" />

            {/* Geofence Boundary Circle */}
            <circle 
              cx="150" 
              cy="150" 
              r={geofenceRadiusPixels} 
              fill={isSimulatingInside ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.02)'} 
              stroke={isSimulatingInside ? '#3b82f6' : '#1d4ed8'} 
              strokeWidth="1.5" 
              className="transition-colors duration-300"
            />
            {/* Geofence outer glowing boundary */}
            <circle 
              cx="150" 
              cy="150" 
              r={geofenceRadiusPixels + 5} 
              fill="none" 
              stroke={isSimulatingInside ? '#3b82f6' : '#1d4ed8'} 
              strokeWidth="0.5" 
              strokeOpacity="0.25"
              className="animate-pulse"
            />

            {/* Hub Office Center Point */}
            <g transform="translate(150, 150)">
              <circle r="4" fill="#3b82f6" />
              <circle r="12" fill="none" stroke="#3b82f6" strokeWidth="1.5" className="animate-ping" style={{ animationDuration: '3s' }} />
            </g>

            {/* User Simulated Current GPS Dot */}
            <g transform={`translate(${userPos.x}, ${userPos.y})`}>
              <circle r="6" fill={isSimulatingInside ? '#60a5fa' : '#3b82f6'} />
              <circle r="14" fill="none" stroke={isSimulatingInside ? '#60a5fa' : '#3b82f6'} strokeWidth="1" className="animate-ping" />
            </g>

            {/* Label texts */}
            <text x="156" y="142" fill="#3b82f6" fontSize="10" className="font-mono font-medium">{settings.name}</text>
            <text x={`${userPos.x + 10}`} y={`${userPos.y - 4}`} fill={isSimulatingInside ? '#60a5fa' : '#3b82f6'} fontSize="9" className="font-mono">User (Simulated)</text>
          </svg>

          {/* Radar Telemetry Metrics Panel overlay */}
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-[11px] font-mono backdrop-blur">
            <div>
              <span className="text-slate-500">RADIUS:</span> <strong className="text-slate-300">{settings.radius}m</strong>
            </div>
            <div>
              <span className="text-slate-500">PROXIMITY:</span> <strong className={`${isSimulatingInside ? 'text-blue-400' : 'text-slate-400'}`}>{currentDistance}m</strong>
            </div>
            <div>
              <span className="text-slate-500">STATE:</span> <span className={`font-bold ${isSimulatingInside ? 'text-blue-400' : 'text-amber-500'}`}>{isSimulatingInside ? 'BREACHED' : 'SECURE'}</span>
            </div>
          </div>
        </div>

        {/* Simulated Movement Presets */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setSimulatedPreset('inside')}
            className={`w-1/2 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isSimulatingInside ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Step Inside Geofence</span>
          </button>
          
          <button
            onClick={() => setSimulatedPreset('outside')}
            className={`w-1/2 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              !isSimulatingInside ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Walk Outside Geofence</span>
          </button>
        </div>

      </div>

      {/* GEOFENCE PARAMETERS & ACTUAL GPS CONTROL */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Param edit card */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
            <Settings2 className="h-4 w-4 text-blue-400" />
            <span>Boundary Configuration</span>
          </h3>

          <div className="space-y-4">
            
            {/* Toggle Enable Geofence */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Enable GPS Geofencing</h4>
                <p className="text-[10px] text-slate-400">Track distance relative to center</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.enabled} 
                  onChange={(e) => handleSaveSettings({ enabled: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-slate-950" />
              </label>
            </div>

            {/* Geofence Name */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Geofence Outpost Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => handleSaveSettings({ name: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500/50 focus:outline-none"
              />
            </div>

            {/* Radius slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase font-mono">Geofence Radius</label>
                <span className="text-xs font-mono font-bold text-blue-400">{settings.radius} meters</span>
              </div>
              <input
                type="range"
                min={50}
                max={500}
                step={25}
                value={settings.radius}
                onChange={(e) => handleSaveSettings({ radius: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            {/* Auto Clock triggers toggles */}
            <div className="space-y-3 pt-3 border-t border-slate-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-medium text-slate-300">Auto Clock-In</h5>
                  <p className="text-[10px] text-slate-500">Initiate session instantly on breach</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.autoClockIn} 
                  onChange={(e) => handleSaveSettings({ autoClockIn: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-medium text-slate-300">Auto Clock-Out</h5>
                  <p className="text-[10px] text-slate-500">Finalize session instantly on egress</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.autoClockOut} 
                  onChange={(e) => handleSaveSettings({ autoClockOut: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/50"
                />
              </div>
            </div>

          </div>
        </div>

        {/* ACTUAL SATELLITE METRIC PANEL */}
        <div className="rounded-3xl border border-slate-800 bg-[#18181B] p-6 shadow-xl">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-4">
            <Sliders className="h-4 w-4 text-blue-400" />
            <span>Satellite Sync Check</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Acquire coordinates from local hardware device positioning. Coordinates will replace geofence center above.
          </p>

          <button
            onClick={handleRequestActualGPS}
            className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-blue-400" />
            <span>Query Device GPS Sensor</span>
          </button>

          {/* GPS telemetry response */}
          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] font-semibold text-slate-500 font-mono block">TELEMETRY STATE</span>
            <p className="mt-1 text-xs text-slate-300 font-mono truncate">{actualLocationStatus}</p>
          </div>
        </div>

      </div>

    </div>
  );
}
