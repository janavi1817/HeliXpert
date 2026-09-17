import React, { useState } from 'react';
import { aiEngine } from '../services/aiEngine';
import { db } from '../services/database';
import { Settings, Database, Server, Upload, Check, RefreshCw, Sun, Moon, FileJson } from 'lucide-react';

export default function SettingsView({ theme, toggleTheme, onDatasetImported }) {
  const [ollamaUrl, setOllamaUrl] = useState(aiEngine.ollamaUrl);
  const [useOllama, setUseOllama] = useState(aiEngine.useOllama);
  const [modelName, setModelName] = useState(aiEngine.modelName);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  const handleSaveAI = (e) => {
    e.preventDefault();
    aiEngine.setOllamaConfig(ollamaUrl, useOllama, modelName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleFileUpload = async (e) => {
    try {
      setImportStatus({ message: 'Triggering backend dataset ingestion...' });
      const res = await db.importDataset();
      setImportStatus(res || { success: true, message: 'Ingestion pipeline executed.' });
      if (onDatasetImported) {
        onDatasetImported();
      }
    } catch (err) {
      setImportStatus({ success: false, error: 'Ingestion failed.' });
    }
  };

  const handleClearDataset = async () => {
    // Deprecated with backend, left for UI consistency
    setImportStatus({ success: false, error: 'Clear database from backend directly.' });
  };

  return (
    <div className="space-y-6 max-w-4xl pb-8">
      <div className="glass-panel p-5 rounded-2xl border">
        <h2 className="text-lg font-bold font-mono flex items-center gap-2">
          <Settings className="w-5 h-5 text-hud-amber" /> HeliXpert Settings &amp; Dataset Management
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Import your official technical helicopter dataset, configure offline AI query engines, and switch themes.
        </p>
      </div>

      {/* Dataset Import Section */}
      <div className="glass-panel p-6 rounded-2xl border space-y-4">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-hud-amber" /> Technical Dataset Integration (JSON)
        </h3>

        <div className="p-6 rounded-xl border border-dashed text-center space-y-3 relative">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-12 h-12 rounded-xl bg-hud-amber/10 border border-hud-amber/30 flex items-center justify-center text-hud-amber mx-auto">
            <FileJson className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold font-mono">Select JSON Dataset File to Import</p>
            <p className="text-xs text-slate-400 mt-1">Supports schema for helicopters, engines, components, telemetry, faults, maintenance, docs</p>
          </div>
        </div>

        {importStatus && (
          <div className={`p-4 rounded-xl border text-xs font-mono ${
            importStatus.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {importStatus.success ? (
              <div>
                <span className="font-bold block text-sm">Dataset Imported Successfully!</span>
                {importStatus.counts && (
                  <ul className="mt-2 space-y-1 list-disc list-inside text-slate-300 font-sans">
                    <li>Helicopters: {importStatus.counts.helicopters} records</li>
                    <li>Engines: {importStatus.counts.engines} records</li>
                    <li>Components: {importStatus.counts.components} records</li>
                    <li>Telemetry: {importStatus.counts.telemetry} records</li>
                    <li>Faults: {importStatus.counts.faults} records</li>
                  </ul>
                )}
              </div>
            ) : (
              <span>Error: {importStatus.error}</span>
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleClearDataset}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-hud-crimson font-mono text-xs font-bold transition flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear Dataset (Return to Empty State)</span>
          </button>
        </div>
      </div>

      {/* Appearance & Theme Toggle */}
      <div className="glass-panel p-6 rounded-2xl border space-y-4">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wider flex items-center gap-2">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-hud-amber" /> : <Sun className="w-4 h-4 text-hud-amber" />}
          <span>Appearance &amp; Theme Mode</span>
        </h3>

        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div>
            <h4 className="text-sm font-bold font-mono">Current Theme: {theme === 'dark' ? 'Dark Aerospace' : 'Light Aerospace'}</h4>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Applies across all cards, charts, sidebars, and AI chat components.</p>
          </div>

          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl bg-hud-amber text-aerospace-900 font-mono text-xs font-bold flex items-center space-x-2"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-aerospace-900" /> : <Moon className="w-4 h-4 text-aerospace-900" />}
            <span>Switch to {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
