import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { Plane, Search, Database, Grid, List, AlertCircle } from 'lucide-react';

export default function Helicopters({ onSelectHelicopter }) {
  const [helicopters, setHelicopters] = useState([]);
  const [search, setSearch] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await db.getHelicopters();
      setHelicopters(data);
      const empty = await db.isEmpty();
      setIsEmpty(empty || data.length === 0);
    };
    fetchData();
  }, []);

  if (isEmpty) {
    return (
      <div className="glass-panel p-12 rounded-2xl border text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
          <Database className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-bold font-mono">No Helicopter Records Available</h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            HeliXpert is awaiting the technical helicopter dataset. Helicopter directory listings and profile records will display automatically once the dataset is imported.
          </p>
        </div>
      </div>
    );
  }

  const filtered = helicopters.filter(h => 
    (h.model || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.tail_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel p-4 rounded-xl border flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tail number or model..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((h) => (
          <div
            key={h.id || h.tail_number}
            onClick={() => onSelectHelicopter(h.id || h.tail_number)}
            className="glass-panel p-5 rounded-2xl border cursor-pointer hover:border-hud-amber transition space-y-3"
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-hud-amber">
                {h.tail_number || h.id}
              </span>
              <span className="text-xs font-mono">{h.status || 'Active'}</span>
            </div>
            <h3 className="text-base font-bold font-mono">{h.model || h.name}</h3>
            <p className="text-xs text-slate-400">{h.manufacturer} &bull; {h.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
