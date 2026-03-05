import { useRef, useState, useCallback } from 'react';
import AnimatedBackground from '@/components/sld-generator/AnimatedBackground';
import HeroSection from '@/components/sld-generator/HeroSection';
import UploadZone from '@/components/sld-generator/UploadZone';
import ProcessSteps from '@/components/sld-generator/ProcessSteps';
import FeatureGrid from '@/components/sld-generator/FeatureGrid';
import SLDPreview from '@/components/sld-generator/SLDPreview';
import { Zap } from 'lucide-react';
import { generateSLD } from '@/services/sld-generation';
import type { SLDLayout } from '@gridvision/shared';

// Fallback simulation layout for when the backend is unavailable
function createSimulatedLayout(): SLDLayout {
  return {
    id: 'sim-001',
    substationId: 'sub-sim-001',
    name: 'Simulated 33/11kV Substation SLD',
    width: 1200,
    height: 800,
    elements: [
      { id: 'bus-33-1', equipmentId: 'eq-bus-33-1', type: 'BUS_BAR', x: 150, y: 120, rotation: 0, label: '33kV Bus Section 1', metadata: { busWidth: 350, voltageKv: 33 } },
      { id: 'bus-33-2', equipmentId: 'eq-bus-33-2', type: 'BUS_BAR', x: 650, y: 120, rotation: 0, label: '33kV Bus Section 2', metadata: { busWidth: 350, voltageKv: 33 } },
      { id: 'cb-inc1', equipmentId: 'eq-cb-inc1', type: 'CIRCUIT_BREAKER', x: 350, y: 70, rotation: 0, label: 'INC1' },
      { id: 'cb-bsc', equipmentId: 'eq-cb-bsc', type: 'CIRCUIT_BREAKER', x: 575, y: 120, rotation: 0, label: 'BSC' },
      { id: 'tr-1', equipmentId: 'eq-tr-1', type: 'POWER_TRANSFORMER', x: 300, y: 250, rotation: 0, label: 'TR-1', metadata: { hvVoltage: 33, lvVoltage: 11, mva: 8 } },
      { id: 'tr-2', equipmentId: 'eq-tr-2', type: 'POWER_TRANSFORMER', x: 800, y: 250, rotation: 0, label: 'TR-2', metadata: { hvVoltage: 33, lvVoltage: 11, mva: 8 } },
      { id: 'bus-11-1', equipmentId: 'eq-bus-11-1', type: 'BUS_BAR', x: 100, y: 420, rotation: 0, label: '11kV Bus Section 1', metadata: { busWidth: 400, voltageKv: 11 } },
      { id: 'bus-11-2', equipmentId: 'eq-bus-11-2', type: 'BUS_BAR', x: 600, y: 420, rotation: 0, label: '11kV Bus Section 2', metadata: { busWidth: 400, voltageKv: 11 } },
      { id: 'cb-bc', equipmentId: 'eq-cb-bc', type: 'CIRCUIT_BREAKER', x: 550, y: 420, rotation: 0, label: 'BC' },
      { id: 'fdr-1', equipmentId: 'eq-fdr-1', type: 'FEEDER_LINE', x: 180, y: 480, rotation: 0, label: 'F1', metadata: { voltageKv: 11 } },
      { id: 'fdr-2', equipmentId: 'eq-fdr-2', type: 'FEEDER_LINE', x: 300, y: 480, rotation: 0, label: 'F2', metadata: { voltageKv: 11 } },
      { id: 'fdr-3', equipmentId: 'eq-fdr-3', type: 'FEEDER_LINE', x: 420, y: 480, rotation: 0, label: 'F3', metadata: { voltageKv: 11 } },
      { id: 'fdr-4', equipmentId: 'eq-fdr-4', type: 'FEEDER_LINE', x: 680, y: 480, rotation: 0, label: 'F4', metadata: { voltageKv: 11 } },
      { id: 'fdr-5', equipmentId: 'eq-fdr-5', type: 'FEEDER_LINE', x: 800, y: 480, rotation: 0, label: 'F5', metadata: { voltageKv: 11 } },
      { id: 'fdr-6', equipmentId: 'eq-fdr-6', type: 'FEEDER_LINE', x: 920, y: 480, rotation: 0, label: 'F6', metadata: { voltageKv: 11 } },
    ],
    connections: [
      { id: 'c1', fromElementId: 'cb-inc1', fromPoint: 'bottom', toElementId: 'bus-33-1', toPoint: 'top', voltageLevel: 33 },
      { id: 'c2', fromElementId: 'bus-33-1', fromPoint: 'bottom', toElementId: 'tr-1', toPoint: 'top', voltageLevel: 33 },
      { id: 'c3', fromElementId: 'bus-33-2', fromPoint: 'bottom', toElementId: 'tr-2', toPoint: 'top', voltageLevel: 33 },
      { id: 'c4', fromElementId: 'tr-1', fromPoint: 'bottom', toElementId: 'bus-11-1', toPoint: 'top', voltageLevel: 11 },
      { id: 'c5', fromElementId: 'tr-2', fromPoint: 'bottom', toElementId: 'bus-11-2', toPoint: 'top', voltageLevel: 11 },
      { id: 'c6', fromElementId: 'bus-11-1', fromPoint: 'bottom', toElementId: 'fdr-1', toPoint: 'top', voltageLevel: 11 },
      { id: 'c7', fromElementId: 'bus-11-1', fromPoint: 'bottom', toElementId: 'fdr-2', toPoint: 'top', voltageLevel: 11 },
      { id: 'c8', fromElementId: 'bus-11-1', fromPoint: 'bottom', toElementId: 'fdr-3', toPoint: 'top', voltageLevel: 11 },
      { id: 'c9', fromElementId: 'bus-11-2', fromPoint: 'bottom', toElementId: 'fdr-4', toPoint: 'top', voltageLevel: 11 },
      { id: 'c10', fromElementId: 'bus-11-2', fromPoint: 'bottom', toElementId: 'fdr-5', toPoint: 'top', voltageLevel: 11 },
      { id: 'c11', fromElementId: 'bus-11-2', fromPoint: 'bottom', toElementId: 'fdr-6', toPoint: 'top', voltageLevel: 11 },
    ],
  };
}

export default function SLDGenerator() {
  const uploadRef = useRef<HTMLDivElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedLayout, setGeneratedLayout] = useState<SLDLayout | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleGenerate = useCallback(async (file: File) => {
    setUploadedFile(file);
    setGeneratedLayout(null);
    setError(null);
    setIsGenerating(true);

    try {
      const layout = await generateSLD(file);
      setGeneratedLayout(layout);
    } catch (err) {
      // Fallback to simulation if backend is unavailable
      const isNetworkError =
        err instanceof Error &&
        (err.message.includes('Network Error') ||
         err.message.includes('ECONNREFUSED') ||
         err.message.includes('timeout'));

      if (isNetworkError) {
        console.warn('Backend unavailable, falling back to simulation mode');
        // Simulate a delay for the animation phases
        await new Promise((resolve) => setTimeout(resolve, 6000));
        setGeneratedLayout(createSimulatedLayout());
      } else {
        const message = err instanceof Error ? err.message : 'SLD generation failed';
        // Extract server error message from axios response if available
        const serverData = (err as { response?: { data?: unknown } })?.response?.data;
        const serverMessage =
          typeof serverData === 'string'
            ? serverData
            : serverData && typeof serverData === 'object'
            ? (serverData as Record<string, unknown>).error
              ? String((serverData as Record<string, unknown>).error)
              : (serverData as Record<string, unknown>).message
              ? String((serverData as Record<string, unknown>).message)
              : JSON.stringify(serverData)
            : null;
        setError(serverMessage || message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    if (uploadedFile) {
      handleGenerate(uploadedFile);
    }
  }, [uploadedFile, handleGenerate]);

  return (
    <div className="relative min-h-screen bg-[#0B1120] text-white overflow-x-hidden">
      {/* Animated network background */}
      <AnimatedBackground />

      {/* Content layers above background */}
      <div className="relative z-10">
        {/* Hero Section */}
        <HeroSection onScrollToUpload={scrollToUpload} />

        {/* Upload Section */}
        <section ref={uploadRef} className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.3em] uppercase text-cyan-400 font-medium">
                Get Started
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 text-white">
                Upload your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  diagram
                </span>
              </h2>
              <p className="mt-4 text-gray-400 max-w-lg mx-auto">
                Drag and drop your hand-drawn SLD, scanned document, or digital file.
                We support images, PDFs, and document formats.
              </p>
            </div>

            <UploadZone onFileUploaded={(file) => handleGenerate(file)} />
          </div>
        </section>

        {/* SLD Preview (shown after upload) */}
        {(uploadedFile || generatedLayout) && (
          <section className="pb-20 px-6">
            <SLDPreview
              file={uploadedFile}
              layout={generatedLayout}
              isGenerating={isGenerating}
              error={error}
              onRegenerate={handleRegenerate}
            />
          </section>
        )}

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        {/* How It Works */}
        <ProcessSteps />

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        {/* Features */}
        <FeatureGrid />

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to digitize your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                substations?
              </span>
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join MSEDCL engineers using GridVision to transform hand-drawn diagrams
              into production-ready SCADA Single Line Diagrams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={scrollToUpload}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-105"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" />
                  Start Now — It's Free
                </span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
              </button>
              <a
                href="/login"
                className="px-8 py-4 border border-gray-600 rounded-xl text-gray-300 font-medium text-lg hover:bg-white/5 hover:border-gray-500 transition-all inline-flex items-center justify-center"
              >
                Sign In to Dashboard
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-gray-300">GridVision SCADA</span>
              <span>v1.0.0</span>
            </div>
            <div>
              Built for MSEDCL Smart Distribution Substations
            </div>
            <div className="flex items-center gap-4">
              <a href="/docs" className="hover:text-gray-300 transition-colors">Documentation</a>
              <a href="/downloads" className="hover:text-gray-300 transition-colors">Downloads</a>
              <a href="/contact" className="hover:text-gray-300 transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
