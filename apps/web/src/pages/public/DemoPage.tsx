import { DemoSimulationProvider } from '@/components/demo/DemoSimulationContext';
import DemoSLDCanvas from '@/components/demo/DemoSLDCanvas';
import DemoControlPanel from '@/components/demo/DemoControlPanel';
import DemoAlarmPanel from '@/components/demo/DemoAlarmPanel';
import { Monitor, MousePointerClick, Timer, AlertTriangle } from 'lucide-react';

export default function DemoPage() {
  return (
    <DemoSimulationProvider>
      <div className="bg-gray-50">
        {/* Hero banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <Monitor className="w-7 h-7" />
              <h1 className="text-2xl font-bold">Interactive SCADA Demo</h1>
            </div>
            <p className="text-blue-100 max-w-2xl">
              Explore a fully simulated 33/11kV distribution substation single-line diagram.
              All equipment is interactive with live simulated measurements.
            </p>
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <MousePointerClick className="w-4 h-4" />
                Click breakers to toggle
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <Timer className="w-4 h-4" />
                Readings update every 2s
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" />
                Random trips every ~15s
              </div>
            </div>
          </div>
        </div>

        {/* SLD canvas + control panel */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="relative flex bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" style={{ height: '70vh', minHeight: 500 }}>
            <div className="flex-1 relative">
              <DemoSLDCanvas />
              <DemoAlarmPanel />
            </div>
            <DemoControlPanel />
          </div>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <LegendItem color="#DC2626" label="33kV (Red)" />
            <LegendItem color="#16A34A" label="11kV (Green)" />
            <LegendItem color="#DC2626" filled label="CB Closed" />
            <LegendItem color="#16A34A" filled={false} label="CB Open" />
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Alt + Drag to pan | Scroll to zoom | This demo runs entirely in your browser — no backend connection required.
          </p>
        </div>
      </div>
    </DemoSimulationProvider>
  );
}

function LegendItem({ color, label, filled }: { color: string; label: string; filled?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
      <div
        className="w-4 h-4 rounded"
        style={{
          backgroundColor: filled !== false ? color : 'transparent',
          border: `2px solid ${color}`,
        }}
      />
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}
