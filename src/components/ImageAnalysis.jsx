import React, { useState } from 'react';
import { visionAi } from '../services/visionAi';
import { db } from '../services/database';
import { Camera, Upload, AlertCircle, Database, Sparkles } from 'lucide-react';

export default function ImageAnalysis() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filename, setFilename] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilename(file.name);
      const url = URL.createObjectURL(file);
      setSelectedImage(url);
      setAnalysisResult(null);
    }
  };
  const runVisionAnalysis = async (src, fname) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await visionAi.analyzeImage(selectedFile, src, fname);
      setAnalysisResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hud-amber/10 border border-hud-amber/20 text-hud-amber text-xs font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>OFFLINE VISION CLASSIFIER</span>
          </div>
          <h2 className="text-xl font-bold font-mono">Helicopter Visual Intelligence</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Upload a helicopter image to analyze visual features and link to your local technical database.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Box */}
        <div className="glass-panel p-6 rounded-2xl border border-dashed border-slate-700 text-center space-y-4 relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          {selectedImage ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700">
              <img src={selectedImage} alt="Uploaded Helicopter" className="w-full h-64 object-cover" />
            </div>
          ) : (
            <div className="py-8 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-hud-amber/10 border border-hud-amber/30 flex items-center justify-center text-hud-amber mx-auto">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold font-mono">Select &amp; Upload Helicopter Image</p>
                <p className="text-xs text-slate-400 mt-1">Runs 100% Client-Side Offline</p>
              </div>
            </div>
          )}
        </div>

        {/* Results Box */}
        <div>
          {isAnalyzing && (
            <div className="glass-panel p-12 rounded-2xl border text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-hud-amber/20 border border-hud-amber/40 flex items-center justify-center text-hud-amber mx-auto animate-spin">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-mono text-hud-amber">Processing Image Features...</p>
            </div>
          )}

          {!isAnalyzing && analysisResult && (
            <div className="glass-panel p-6 rounded-2xl border space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-mono flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm">Dataset Integration Pending</span>
                  <p className="mt-1 text-slate-300 font-sans">
                    Image uploaded successfully. Helicopter technical data lookup will become active once your technical dataset is imported into HeliXpert.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isAnalyzing && !analysisResult && (
            <div className="glass-panel p-12 rounded-2xl border text-center text-slate-400 font-mono text-xs">
              Upload an image to start visual analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
