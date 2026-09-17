import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import EmptyState from './EmptyState';
import { TrendingUp, AlertCircle, Database, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function PrognosticsView() {
  const [cmapssSummary, setCmapssSummary] = useState(null);
  const [cmapssData, setCmapssData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState('all');

  useEffect(() => {
    const loadPrognostics = async () => {
      setLoading(true);
      const [summary, data] = await Promise.all([
        dataService.getCMApssSummary(),
        dataService.getCMAPSSData()
      ]);
      
      if (summary && !summary.isEmpty) {
        setCmapssSummary(summary);
      }
      if (data && !data.isEmpty) {
        setCmapssData(data.data || []);
      }
      setLoading(false);
    };
    loadPrognostics();
  }, []);

  if (loading) {
    return <EmptyState title="Loading Prognostics Data" message="Fetching NASA C-MAPSS data..." loading={true} type="info" />;
  }

  if (!cmapssSummary || cmapssSummary.message) {
    return (
      <EmptyState 
        title="No Prognostics Data"
        message="NASA C-MAPSS turbofan dataset not loaded. Import the C-MAPSS dataset to view engine prognostics data."
        type="warning"
      />
    );
  }

  const datasets = cmapssSummary.datasets || [];
  
  // Filter data by selected dataset
  const filteredData = selectedDataset === 'all' 
    ? cmapssData 
    : cmapssData.filter(d => d.dataset_name === selectedDataset);

  // Prepare chart data (showing sensor trends for first engine unit)
  const chartData = filteredData
    .filter(d => d.engine_unit === 1)
    .slice(0, 100)
    .map(d => ({
      cycle: d.cycle,
      sensor1: d.sensor_1,
      sensor2: d.sensor_2,
      sensor3: d.sensor_3,
      rul: d.rul
    }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="card-premium p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 gold-accent" /> Engine Prognostics & RUL Analysis
          </h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            NASA C-MAPSS Turbofan Engine Degradation Research Dataset
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Database className="w-4 h-4 text-primary-500" />
          <span className="font-mono text-muted">Real Dataset</span>
        </div>
      </div>

      {/* Important Warning */}
      <div className="card-premium p-4 bg-warning-light/5 dark:bg-warning-dark/5 border-warning-light/20 dark:border-warning-dark/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning-light dark:text-warning-dark flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-mono font-bold text-sm text-foreground mb-1">Dataset Information</h4>
            <p className="text-xs text-muted leading-relaxed">
              <strong>NASA C-MAPSS</strong> is a <strong>turbofan engine degradation simulation dataset</strong> designed for aerospace prognostics research. 
              This is <strong>NOT helicopter data</strong>. It provides aircraft turbofan sensor measurements and RUL (Remaining Useful Life) targets for prognostics algorithm development.
            </p>
          </div>
        </div>
      </div>

      {/* Dataset Summary Stats */}
      {datasets.length > 0 && (
        <div>
          <h3 className="text-sm font-bold font-mono text-foreground mb-3">
            Available C-MAPSS Datasets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((ds, idx) => (
              <div key={idx} className="card-premium p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary-500 px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/20">
                    {ds.dataset_name}
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted">Observations:</span>
                    <span className="text-foreground font-bold">{ds.observations?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Engine Units:</span>
                    <span className="text-foreground font-bold">{ds.engine_units || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Max Cycles:</span>
                    <span className="text-foreground font-bold">{ds.max_cycles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Avg RUL:</span>
                    <span className="gold-accent font-bold">{ds.avg_rul?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dataset Selector */}
      <div className="card-premium p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted">Select Dataset:</span>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="input-primary px-3 py-2 text-xs"
          >
            <option value="all">All Datasets</option>
            {datasets.map(ds => (
              <option key={ds.dataset_name} value={ds.dataset_name}>
                {ds.dataset_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted font-mono">
            Showing {filteredData.length.toLocaleString()} observations
          </span>
        </div>
      </div>

      {/* Sensor Trend Chart */}
      {chartData.length > 0 && (
        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-foreground">
              Sensor Degradation Trend - Engine Unit 1
            </h3>
            <span className="text-xs font-mono text-muted">
              First 100 cycles
            </span>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis 
                  dataKey="cycle" 
                  stroke="rgb(var(--muted))" 
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Engine Cycle', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                />
                <YAxis 
                  stroke="rgb(var(--muted))" 
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Sensor Value', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(var(--surface))', 
                    borderColor: 'rgb(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="sensor1" stroke="#FFCC33" strokeWidth={2} dot={false} name="Sensor 1" />
                <Line type="monotone" dataKey="sensor2" stroke="#60a5fa" strokeWidth={2} dot={false} name="Sensor 2" />
                <Line type="monotone" dataKey="sensor3" stroke="#34d399" strokeWidth={2} dot={false} name="Sensor 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sample Data Table */}
      {filteredData.length > 0 && (
        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-variant font-mono text-xs text-muted font-bold">
            C-MAPSS Observation Sample (First 20 records)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-surface-variant text-muted border-b border-border uppercase">
                <tr>
                  <th className="p-3">Dataset</th>
                  <th className="p-3">Engine Unit</th>
                  <th className="p-3">Cycle</th>
                  <th className="p-3">Sensor 1</th>
                  <th className="p-3">Sensor 2</th>
                  <th className="p-3">Sensor 3</th>
                  <th className="p-3">RUL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredData.slice(0, 20).map((d, idx) => (
                  <tr key={idx} className="hover:bg-surface-variant/40">
                    <td className="p-3 text-muted text-[11px]">{d.dataset_name}</td>
                    <td className="p-3 gold-accent font-bold">{d.engine_unit}</td>
                    <td className="p-3">{d.cycle}</td>
                    <td className="p-3">{d.sensor_1?.toFixed(3) || 'N/A'}</td>
                    <td className="p-3">{d.sensor_2?.toFixed(3) || 'N/A'}</td>
                    <td className="p-3">{d.sensor_3?.toFixed(3) || 'N/A'}</td>
                    <td className="p-3 font-bold">{d.rul?.toFixed(1) || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* About C-MAPSS */}
      <div className="card-premium p-4 bg-primary-500/5 border-primary-500/20">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-mono font-bold text-sm text-foreground mb-1">About C-MAPSS Dataset</h4>
            <p className="text-xs text-muted leading-relaxed mb-2">
              <strong>Commercial Modular Aero-Propulsion System Simulation (C-MAPSS)</strong> from NASA Ames Research Center. 
              This dataset simulates turbofan engine degradation with multiple operational conditions and fault modes.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Used for prognostics research, RUL prediction algorithm development, and condition-based maintenance studies. 
              Contains sensor measurements, operational conditions, and RUL targets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
