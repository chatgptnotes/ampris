import { useState, useEffect } from 'react';
import { Loader2, Download, ExternalLink, RotateCcw } from 'lucide-react';
import type { SLDLayout } from '@gridvision/shared';
import DynamicSLDRenderer from './DynamicSLDRenderer';

interface Props {
  file: File | null;
  layout?: SLDLayout | null;
  isGenerating?: boolean;
  error?: string | null;
  onRegenerate?: () => void;
}

type GenerationPhase = 'idle' | 'detecting' | 'mapping' | 'generating' | 'rendering' | 'done';

const phaseMessages: Record<GenerationPhase, string> = {
  idle: '',
  detecting: 'Detecting equipment symbols and labels...',
  mapping: 'Mapping connections and topology...',
  generating: 'Generating IEC-compliant SLD layout...',
  rendering: 'Rendering interactive SVG components...',
  done: 'SLD generated successfully!',
};

export default function SLDPreview({ file, layout, isGenerating, error, onRegenerate }: Props) {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [progress, setProgress] = useState(0);

  // Animate through phases while generating
  useEffect(() => {
    if (!isGenerating) {
      if (layout) {
        setPhase('done');
        setProgress(100);
      }
      return;
    }

    setPhase('detecting');
    setProgress(0);

    const phases: GenerationPhase[] = ['detecting', 'mapping', 'generating', 'rendering'];
    let currentPhase = 0;

    const interval = setInterval(() => {
      if (currentPhase < phases.length) {
        setPhase(phases[currentPhase]);
        setProgress(((currentPhase + 1) / phases.length) * 100);
        currentPhase++;
      }
      // Don't auto-advance to 'done' — wait for layout prop
    }, 2500);

    return () => clearInterval(interval);
  }, [isGenerating, layout]);

  // When layout arrives, jump to done
  useEffect(() => {
    if (layout && !isGenerating) {
      setPhase('done');
      setProgress(100);
    }
  }, [layout, isGenerating]);

  if (!file && !layout) return null;

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-12">
        <div className="rounded-2xl border border-red-800/50 bg-red-900/20 backdrop-blur-sm p-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-lg">!</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Generation Failed</h3>
              <p className="text-sm text-red-300 mt-1">
                {typeof error === 'string' ? error : JSON.stringify(error)}
              </p>
            </div>
          </div>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-12">
      {/* Generation progress (during loading) */}
      {phase !== 'done' && isGenerating && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20" />
              <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400 animate-spin" />
              <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Generating Your SLD</h3>
              <p className="text-sm text-gray-400">{phaseMessages[phase]}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {['Detect', 'Map', 'Generate', 'Render'].map((label, i) => {
                const phaseIndex = i + 1;
                const isActive = progress >= (phaseIndex / 4) * 100;
                return (
                  <div key={label} className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mb-1 transition-colors ${isActive ? 'bg-cyan-400' : 'bg-gray-700'}`} />
                    <span className={`text-[10px] ${isActive ? 'text-cyan-400' : 'text-gray-600'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Generated SLD Preview */}
      {phase === 'done' && layout && (
        <div className="rounded-2xl border border-gray-700 bg-gray-900/50 backdrop-blur-sm overflow-hidden animate-fade-in">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-white">Generated Single Line Diagram</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                IEC 61850
              </span>
              <span className="text-xs text-gray-500">
                {layout.elements.length} elements &middot; {layout.connections.length} connections
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Regenerate
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors">
                <Download className="w-3 h-3" />
                Export SVG
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs rounded-lg transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
                <ExternalLink className="w-3 h-3" />
                Open in SCADA
              </button>
            </div>
          </div>

          {/* Dynamic SLD render */}
          <div className="bg-[#0B1120] p-6">
            <DynamicSLDRenderer layout={layout} />
          </div>
        </div>
      )}
    </div>
  );
}
