import React, { useState, useRef } from 'react';
import {
  Camera, Upload, AlertTriangle, CheckCircle2,
  Eye, Activity, Shield, Wrench, ImageIcon, RefreshCw
} from 'lucide-react';

const SEVERITY_STYLES = {
  high:   'bg-red-500/10 text-red-400 border border-red-500/30',
  medium: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  low:    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
};

const STATUS_STYLES = {
  Healthy:  'text-green-400',
  Warning:  'text-yellow-400',
  Damaged:  'text-orange-400',
  Critical: 'text-red-400',
};

const STATUS_BAR = {
  Healthy:  'bg-green-500',
  Warning:  'bg-yellow-500',
  Damaged:  'bg-orange-500',
  Critical: 'bg-red-500',
};

export default function ImageAnalysis() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image (JPG, PNG, BMP).');
      return;
    }
    setSelectedImage(file);
    setResults(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleImageUpload(fakeEvent);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedImage);
      const res = await fetch('http://localhost:8000/api/vision/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Analysis failed');
      }
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message || 'Vision AI unavailable. Make sure the backend is running on port 8000.');
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResults(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isHealthy = results && !results.defects_detected;
  const isDamaged = results && results.defects_detected;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="card-premium p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-mono text-foreground flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary-500" />
            Image Vision AI — Helicopter Inspection
          </h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            Upload a helicopter image to detect defects by part, or confirm healthy status.
          </p>
        </div>
        {results && (
          <button onClick={reset} className="btn-secondary flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> New Analysis
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="card-premium p-6 space-y-4">
          <h3 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary-500" /> Upload Image
          </h3>

          {/* Drop zone */}
          <label
            className="block cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className={`border-2 border-dashed rounded-xl transition-colors ${
              imagePreview ? 'border-primary-500/40' : 'border-border hover:border-primary-500/50'
            } p-4`}>
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Uploaded helicopter"
                  className="w-full h-64 object-contain rounded-lg bg-surface"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <ImageIcon className="w-12 h-12 text-muted" />
                  <p className="text-sm font-mono text-foreground font-bold">
                    Click or drag & drop
                  </p>
                  <p className="text-xs text-muted font-mono">JPG, PNG, BMP — max 15MB</p>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>

          {selectedImage && (
            <p className="text-xs text-muted font-mono truncate">
              📎 {selectedImage.name} ({(selectedImage.size / 1024).toFixed(0)} KB)
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={analyzeImage}
            disabled={!selectedImage || analyzing}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Eye className="w-4 h-4" />
            {analyzing ? 'Analyzing...' : 'Analyze Helicopter'}
          </button>

          {/* Tips */}
          <div className="p-3 rounded-lg bg-surface-variant border border-border text-xs font-mono text-muted space-y-1">
            <p className="font-semibold text-foreground mb-1">Tips for best results:</p>
            <p>• Use clear, well-lit helicopter images</p>
            <p>• Full side or top-down view works best</p>
            <p>• Damaged images: show visible cracks, rust, or deformation</p>
          </div>
        </div>

        {/* Results Panel */}
        <div className="card-premium p-6 space-y-4">
          <h3 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-500" /> Analysis Results
          </h3>

          {!results && !analyzing && (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
              <Camera className="w-12 h-12 text-muted/40" />
              <p className="text-sm font-mono text-muted">Upload and analyze an image to see results here.</p>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
              <p className="text-sm font-mono text-muted">Running visual inspection...</p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              {/* Overall Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                isHealthy
                  ? 'bg-green-500/10 border-green-500/30'
                  : results.overall_status === 'Critical'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-orange-500/10 border-orange-500/30'
              }`}>
                {isHealthy
                  ? <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  : <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                }
                <div>
                  <p className={`text-sm font-bold font-mono ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                    {results.overall_status} — Health Score: {results.health_score}%
                  </p>
                  <p className="text-xs text-muted font-mono mt-0.5">{results.summary}</p>
                </div>
              </div>

              {/* Defects Found */}
              {isDamaged && results.detections && results.detections.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Defects Detected
                  </h4>
                  {results.detections.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-surface-variant border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono text-foreground">{d.type}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.low}`}>
                          {(d.severity || 'low').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted font-mono">📍 {d.location}</p>
                      <p className="text-xs text-muted font-mono">Confidence: {(d.confidence * 100).toFixed(0)}%</p>
                      <p className="text-xs font-mono text-primary-500 mt-1">→ {d.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Health status for healthy helicopter */}
              {isHealthy && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400">
                  <Shield className="w-4 h-4 inline mr-1.5" />
                  All systems nominal. No defects detected. Helicopter is airworthy based on visual inspection.
                </div>
              )}

              {/* Detector Scores breakdown */}
              {results.detector_scores && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-muted font-semibold uppercase tracking-wider">Detector Signals</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(results.detector_scores).map(([key, score]) => {
                      const pct = Math.round(score * 100);
                      const label = {
                        rust: 'Rust/Corrosion',
                        dark_stains: 'Dark Stains',
                        texture: 'Surface Texture',
                        color_anomaly: 'Color Anomaly',
                        edges: 'Edge Cracks',
                        patchiness: 'Patchiness',
                      }[key] || key;
                      const color = pct > 30 ? 'bg-red-500' : pct > 15 ? 'bg-orange-400' : 'bg-green-500';
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted w-28 shrink-0">{label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted w-6 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Processing info */}
              <p className="text-[10px] font-mono text-muted">
                {results.model_used} · {results.processing_time}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Part-by-Part Assessment — shown after analysis */}
      {results && results.part_assessments && (
        <div className="card-premium p-6 space-y-4">
          <h3 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-500" /> Part-by-Part Assessment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {results.part_assessments.map((part, i) => (
              <div key={i} className="p-3 rounded-lg bg-surface-variant border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-foreground font-semibold leading-tight">{part.part}</span>
                  <span className={`text-[10px] font-mono font-bold ${STATUS_STYLES[part.status] || 'text-muted'}`}>
                    {part.status}
                  </span>
                </div>
                {/* Health bar */}
                <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_BAR[part.status] || 'bg-muted'}`}
                    style={{ width: `${part.health_score}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-muted">{part.health_score}% health</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
