import React, { useState, useEffect } from 'react';
import { aiEngine } from '../services/aiEngine';
import { dataService } from '../services/dataService';
import EmptyState from './EmptyState';
import { Settings, Database, Server, RefreshCw, Check, Activity, CheckCircle2 } from 'lucide-react';

export default function SettingsView() {
  const [ollamaUrl, setOllamaUrl] = useState(aiEngine.ollamaUrl);
  const [useOllama, setUseOllama] = useState(aiEngine.useOllama);
  const [modelName, setModelName] = useState(aiEngine.modelName);
  const [saved, setSaved] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      const status = await dataService.getSystemStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Error loading system status:', error);
      setSystemStatus({ database: 'error', backend: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    aiEngine.setOllamaConfig(ollamaUrl, useOllama, modelName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReloadDatasets = async () => {
    if (window.confirm("Reload all datasets from raw data files? This may take a few minutes.")) {
      try {
        alert('Please run setup_offline.bat to reload datasets from the terminal.');
      } catch (error) {
        console.error('Error reloading datasets:', error);
        alert('Failed to reload datasets. Please run setup_offline.bat manually.');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <EmptyState 
          title="Loading Settings"
          message="Fetching system configuration..."
          loading={true}
          type="info"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-8">
      {/* Header */}
      <div className="card-premium p-5">
        <h2 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500" /> HeliXpert System Configuration
        </h2>
        <p className="text-xs text-muted font-mono mt-0.5">
          Configure offline AI query processing, local LLM server endpoints, and relational database persistence.
        </p>
      </div>

      {/* System Status */}
      <div className="card-premium p-6 space-y-4">
        <h3 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary-500" /> System Health Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-variant border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-foreground">Backend API</span>
              {systemStatus?.backend === 'online' ? (
                <span className="status-success text-xs px-2 py-0.5 rounded font-mono">Online</span>
              ) : (
                <span className="status-error text-xs px-2 py-0.5 rounded font-mono">Offline</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-variant border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-foreground">SQLite Database</span>
              {systemStatus?.database === 'ready' ? (
                <span className="status-success text-xs px-2 py-0.5 rounded font-mono">Ready</span>
              ) : (
                <span className="status-error text-xs px-2 py-0.5 rounded font-mono">Error</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-variant border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-foreground">Datasets Loaded</span>
              <span className="text-sm font-bold gold-accent font-mono">
                {systemStatus?.datasets_loaded || 0}/5
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-variant border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-foreground">Offline Mode</span>
              <span className="status-success text-xs px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 100%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Local AI Engine Settings */}
      <div className="card-premium p-6 space-y-4">
        <h3 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-primary-500" /> Offline AI Execution Mode
        </h3>

        <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-surface-variant border border-border space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useOllama}
                onChange={(e) => setUseOllama(e.target.checked)}
                className="w-4 h-4 rounded text-primary-500 focus:ring-0 bg-surface border-border"
              />
              <span className="text-foreground font-bold">Connect to Local LLM Server (Ollama / Llama.cpp)</span>
            </label>
            <p className="text-muted text-[11px] pl-7">
              When disabled (Default), HeliXpert uses its instant client-side Intent & Safe SQL processor.
            </p>
          </div>

          {useOllama && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
              <div>
                <label className="text-muted block mb-1">Local Ollama Server URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-muted block mb-1">Model Tag / Identifier</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
            >
              {saved ? <Check className="w-4 h-4" /> : null}
              <span>{saved ? 'Configuration Saved!' : 'Save AI Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Local Database Management */}
      <div className="card-premium p-6 space-y-4">
        <h3 className="text-sm font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-primary-500" /> Dataset Management
        </h3>

        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-variant border border-border">
          <div>
            <h4 className="text-sm font-bold text-foreground font-mono">Reload All Datasets</h4>
            <p className="text-xs text-muted font-mono mt-0.5">
              Re-ingest raw CSV and H5 files: helicopters, maintenance logs, PHM telemetry, C-MAPSS data.
            </p>
          </div>
          <button
            onClick={handleReloadDatasets}
            className="btn-secondary flex items-center space-x-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Data</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-info-light/10 dark:bg-info-dark/10 border border-info-light/20 dark:border-info-dark/20">
          <p className="text-xs font-mono text-info-light dark:text-info-dark leading-relaxed">
            <strong>Note:</strong> To fully reload datasets from raw files, run <code className="px-1 py-0.5 bg-surface rounded">setup_offline.bat</code> from the project root directory. This will re-create the SQLite database with all CSV and H5 data sources.
          </p>
        </div>
      </div>
    </div>
  );
}
