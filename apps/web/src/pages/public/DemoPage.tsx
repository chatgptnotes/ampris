import { useState, useCallback } from 'react';
import { DemoSimulationProvider } from '@/components/demo/DemoSimulationContext';
import DemoSLDCanvas from '@/components/demo/DemoSLDCanvas';
import DemoControlPanel from '@/components/demo/DemoControlPanel';
import DemoAlarmPanel from '@/components/demo/DemoAlarmPanel';
import {
  Activity, TrendingUp, Bell, BarChart3,
  Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw,
  Circle,
} from 'lucide-react';

import DemoTrendsPage from '@/components/demo/DemoTrendsPage';
import DemoAlarmsPage from '@/components/demo/DemoAlarmsPage';
import DemoAnalyticsPage from '@/components/demo/DemoAnalyticsPage';

type DemoTab = 'sld' | 'trends' | 'alarms' | 'analytics';

const TABS = [
  { id: 'sld' as const, label: 'Substation SLD', icon: Activity },
  { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
  { id: 'alarms' as const, label: 'Alarms', icon: Bell },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>('sld');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  return (
    <DemoSimulationProvider>
      <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[9999] bg-white' : 'min-h-[calc(100vh-4rem)]'}`}>
        {/* Top toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Station name */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-gray-900 text-sm">33/11kV Demo Substation</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">SIMULATION</span>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200" />

            {/* Tabs */}
            <div className="flex gap-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-3 mr-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-red-500 text-red-500" />
                Energized
              </span>
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                De-energized
              </span>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 bg-gray-50 overflow-hidden">
          {activeTab === 'sld' && (
            <div className="h-full flex">
              {/* SLD Canvas - takes full space */}
              <div className="flex-1 relative">
                <DemoSLDCanvas />
                <DemoAlarmPanel />

                {/* Zoom hints overlay */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-gray-400 bg-white/80 backdrop-blur rounded-md px-2 py-1 border border-gray-200">
                  <span>Scroll to zoom</span>
                  <span className="text-gray-300">|</span>
                  <span>Drag to pan</span>
                  <span className="text-gray-300">|</span>
                  <span>Click breakers to toggle</span>
                </div>
              </div>

              {/* Control Panel sidebar */}
              <DemoControlPanel />
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="h-full overflow-auto p-4">
              <DemoTrendsPage />
            </div>
          )}

          {activeTab === 'alarms' && (
            <div className="h-full overflow-auto p-4">
              <DemoAlarmsPage />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="h-full overflow-auto p-4">
              <DemoAnalyticsPage />
            </div>
          )}
        </div>

        {/* Bottom status bar */}
        <div className="bg-gray-900 text-gray-400 px-4 py-1.5 flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              System Online
            </span>
            <span>Refresh: 2s</span>
            <span>Protocol: IEC 61850 (Simulated)</span>
          </div>
          <div className="flex items-center gap-4">
            <span>GridVision SCADA v2.0</span>
            <span className="text-gray-500">drmhope.com | A Bettroi Product</span>
          </div>
        </div>
      </div>
    </DemoSimulationProvider>
  );
}
