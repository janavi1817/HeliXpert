import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { Plane, ArrowLeft, Database } from 'lucide-react';

export default function HelicopterDetails({ helicopterId, onBack }) {
  const [helicopter, setHelicopter] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const empty = await db.isEmpty();
      setIsEmpty(empty);
      if (helicopterId && !empty) {
        const heli = await db.getHelicopterById(helicopterId);
        setHelicopter(heli);
      }
    };
    fetchData();
  }, [helicopterId]);

  if (isEmpty || !helicopter) {
    return (
      <div className="glass-panel p-12 rounded-2xl border text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
          <Database className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-bold font-mono">Digital Twin Profile Awaiting Dataset</h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            No helicopter digital twin records are available. Import the technical dataset to populate airframe profiles, engine specifications, and telemetry graphs.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-800 text-hud-amber font-mono text-xs"
        >
          Return to Fleet Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel p-6 rounded-2xl border flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2.5 rounded-xl bg-slate-900 border text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-mono">{helicopter.model || helicopter.name}</h1>
            <p className="text-xs text-slate-400 font-mono">{helicopter.tail_number} &bull; {helicopter.manufacturer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
