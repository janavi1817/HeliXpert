import React, { useState, useEffect } from 'react';
import { db } from '../services/database'; // We'll just use raw fetch or add to db service
import { Activity, Search, AlertTriangle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PrognosticsView() {
  const [summary, setSummary] = useState(null);
  const [engineId, setEngineId] = useState(1);
  const [engineData, setEngineData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/cmapss/summary');
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    const fetchEngineData = async () => {
      if (!engineId) return;
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/cmapss/engine/${engineId}`);
        const data = await res.json();
        setEngineData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEngineData();
  }, [engineId]);

  return (
    <div className="space-y-6 pb-8 max-w-6xl">
      <div className="glass-panel p-6 rounded-2xl border">
        <div className="flex items-center space-x-3 mb-2">
          <Activity className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold font-mono">Aerospace Engine Prognostics Reference</h2>
        </div>
        <p className="text-sm text-slate-400 font-sans">
          NASA C-MAPSS turbofan dataset. (This is distinct from the helicopter telemetry dataset).
        </p>
        
        {summary && (
          <div className="mt-4 flex space-x-4">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400">Total Engines</p>
              <p className="text-lg font-bold font-mono">{summary.total_engines}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400">Total Cycles</p>
              <p className="text-lg font-bold font-mono">{summary.total_cycles}</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 rounded-2xl border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-mono">Engine Lifecycle Analysis</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400">Unit Number:</span>
            <input 
              type="number" 
              min="1" 
              max={summary?.total_engines || 100} 
              value={engineId} 
              onChange={(e) => setEngineId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm font-mono w-20 text-center"
            />
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">Loading engine data...</div>
        ) : engineData.length > 0 ? (
          <div className="space-y-8">
            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-2">Sensor 2 (LPC Outlet Temp) over Cycles</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time_in_cycles" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Line type="monotone" dataKey="sensor_2" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-2">Sensor 21 (LPT Coolant Bleed) over Cycles</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time_in_cycles" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f43f5e' }}
                    />
                    <Line type="monotone" dataKey="sensor_21" stroke="#f43f5e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">No data available for this engine unit.</div>
        )}
      </div>
    </div>
  );
}
