import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { AlertTriangle, Database, Plus, Search } from 'lucide-react';

export default function FaultsView() {
  const [faults, setFaults] = useState([]);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await db.getFaults();
      setFaults(data);
      const empty = await db.isEmpty();
      setIsEmpty(empty || data.length === 0);
    };
    fetchData();
  }, []);

  if (isEmpty && faults.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl border text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
          <Database className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-bold font-mono">No Fault Records Available</h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            HeliXpert is awaiting the technical dataset. Fault logs, exceedance alerts, and P0 grounding records will display once imported.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel p-5 rounded-2xl border">
        <h2 className="text-lg font-bold font-mono">Fault &amp; Exceedance Management</h2>
      </div>
    </div>
  );
}
