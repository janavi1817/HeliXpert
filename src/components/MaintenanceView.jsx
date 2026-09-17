import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { Wrench, Database } from 'lucide-react';

export default function MaintenanceView() {
  const [records, setRecords] = useState([]);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await db.getMaintenance();
      setRecords(data);
      const empty = await db.isEmpty();
      setIsEmpty(empty || data.length === 0);
    };
    fetchData();
  }, []);

  if (isEmpty && records.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl border text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
          <Database className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-bold font-mono">No Maintenance Records Available</h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Maintenance service logs, phase 100-hr inspection sign-offs, and technician records will appear once the technical dataset is loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel p-5 rounded-2xl border">
        <h2 className="text-lg font-bold font-mono">Maintenance &amp; Overhaul Log</h2>
      </div>
    </div>
  );
}
