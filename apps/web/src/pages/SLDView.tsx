import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { useSLDStore } from '@/stores/sldStore';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { useNumericValue, useDigitalState } from '@/hooks/useRealTimeData';
import SLDCanvas from '@/components/sld/SLDCanvas';
import ControlDialog from '@/components/controls/ControlDialog';
import type { Substation } from '@gridvision/shared';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { X, Zap, Activity } from 'lucide-react';

export default function SLDView() {
  const { substationId } = useParams();
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [showControl, setShowControl] = useState(false);
  const [popupTag, setPopupTag] = useState<string | null>(null);
  const selectedSubstation = useSLDStore((s) => s.selectedSubstation);
  const setSelectedSubstation = useSLDStore((s) => s.setSelectedSubstation);
  const selectedEquipmentId = useSLDStore((s) => s.selectedEquipmentId);
  const zoom = useSLDStore((s) => s.zoom);
  const setZoom = useSLDStore((s) => s.setZoom);
  const resetView = useSLDStore((s) => s.resetView);

  useEffect(() => {
    api.get('/substations').then(({ data }) => {
      setSubstations(data);
      if (substationId) {
        const ss = data.find((s: Substation) => s.id === substationId);
        if (ss) setSelectedSubstation(ss);
      } else if (data.length > 0 && !selectedSubstation) {
        setSelectedSubstation(data[0]);
      }
    });
  }, [substationId]);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-scada-panel border border-scada-border rounded-lg px-4 py-2">
        <div className="flex items-center gap-3">
          <select
            value={selectedSubstation?.id || ''}
            onChange={(e) => {
              const ss = substations.find((s) => s.id === e.target.value);
              if (ss) setSelectedSubstation(ss);
            }}
            className="bg-scada-bg border border-scada-border rounded px-3 py-1 text-sm"
          >
            {substations.map((ss) => (
              <option key={ss.id} value={ss.id}>{ss.name}</option>
            ))}
          </select>

          {selectedSubstation && (
            <span className="text-xs px-2 py-0.5 rounded bg-scada-accent/20 text-scada-accent">
              {selectedSubstation.type}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Zoom: {Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(zoom + 0.1)} className="px-2 py-1 bg-scada-bg border border-scada-border rounded text-sm hover:bg-scada-border/50">+</button>
          <button onClick={() => setZoom(zoom - 0.1)} className="px-2 py-1 bg-scada-bg border border-scada-border rounded text-sm hover:bg-scada-border/50">-</button>
          <button onClick={resetView} className="px-2 py-1 bg-scada-bg border border-scada-border rounded text-sm hover:bg-scada-border/50">Reset</button>
        </div>
      </div>

      {/* SLD Canvas with Live Overlays */}
      <div className="flex-1 bg-scada-panel border border-scada-border rounded-lg overflow-hidden relative">
        {selectedSubstation ? (
          <>
            <SLDCanvas
              substation={selectedSubstation}
              onEquipmentDoubleClick={() => setShowControl(true)}
            />
            {/* Live value overlay */}
            <LiveOverlayPanel onTagClick={setPopupTag} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a substation to view its Single Line Diagram
          </div>
        )}
      </div>

      {/* Equipment Detail Popup */}
      {popupTag && (
        <EquipmentPopup tag={popupTag} onClose={() => setPopupTag(null)} />
      )}

      {/* Control Dialog */}
      {showControl && selectedEquipmentId && (
        <ControlDialog
          equipmentId={selectedEquipmentId}
          onClose={() => setShowControl(false)}
        />
      )}
    </div>
  );
}

// ─────────────────── Live Overlay Panel ───────────────────

function LiveOverlayPanel({ onTagClick }: { onTagClick: (tag: string) => void }) {
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);

  return (
    <div className="absolute top-2 right-2 w-52 space-y-1.5 pointer-events-auto">
      <div className={`rounded px-2 py-1 text-[10px] flex items-center gap-1 ${
        connectionStatus === 'connected' ? 'bg-green-900/80 text-green-400' : 'bg-red-900/80 text-red-400'
      }`}>
        <Activity className="w-3 h-3" />
        {connectionStatus === 'connected' ? 'LIVE DATA' : 'OFFLINE'}
      </div>

      <OverlayValue tag="INC_33KV_V_RY" label="33kV Bus" unit="kV" onClick={onTagClick} />
      <OverlayValue tag="BUS_11KV_V" label="11kV Bus" unit="kV" onClick={onTagClick} />
      <OverlayValue tag="SYS_FREQ" label="Frequency" unit="Hz" onClick={onTagClick} />
      <OverlayValue tag="SYS_TOTAL_LOAD" label="Total Load" unit="MW" onClick={onTagClick} />

      {/* CB Status Grid */}
      <div className="bg-scada-panel/90 rounded p-1.5 border border-scada-border">
        <div className="text-[9px] text-gray-400 mb-1">Circuit Breakers</div>
        <div className="grid grid-cols-3 gap-0.5">
          <CBDot tag="TR1_HV_CB" label="T1HV" />
          <CBDot tag="TR1_LV_CB" label="T1LV" />
          <CBDot tag="TR2_HV_CB" label="T2HV" />
          <CBDot tag="TR2_LV_CB" label="T2LV" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CBDot key={i} tag={`FDR${String(i).padStart(2, '0')}_CB`} label={`F${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OverlayValue({ tag, label, unit, onClick }: {
  tag: string; label: string; unit: string; onClick: (tag: string) => void;
}) {
  const value = useNumericValue(tag, 2);
  return (
    <button
      onClick={() => onClick(tag)}
      className="w-full bg-scada-panel/90 rounded px-2 py-1 border border-scada-border text-left hover:bg-scada-accent/10"
    >
      <div className="text-[9px] text-gray-400">{label}</div>
      <div className="text-sm font-mono font-bold">
        {value} <span className="text-[10px] text-gray-400 font-normal">{unit}</span>
      </div>
    </button>
  );
}

function CBDot({ tag, label }: { tag: string; label: string }) {
  const state = useDigitalState(tag);
  const color = state === undefined ? 'bg-gray-600' : state ? 'bg-green-500' : 'bg-red-500';
  return (
    <div className="text-center">
      <div className={`w-2.5 h-2.5 rounded-full mx-auto ${color} ${state === false ? 'alarm-flash' : ''}`} />
      <div className="text-[8px] text-gray-400">{label}</div>
    </div>
  );
}

// ─────────────────── Equipment Detail Popup ───────────────────

function EquipmentPopup({ tag, onClose }: { tag: string; onClose: () => void }) {
  const value = useNumericValue(tag, 3);
  const [trendData, setTrendData] = useState<Array<{ time: number; value: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const rtVal = useRealtimeStore.getState().values[tag];
      if (rtVal && typeof rtVal.value === 'number') {
        setTrendData((prev) => {
          const now = Date.now();
          const filtered = prev.filter((p) => now - p.time < 60000);
          return [...filtered, { time: now, value: rtVal.value as number }];
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tag]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-scada-panel border border-scada-border rounded-lg w-[400px] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-scada-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-scada-accent" />
            <h3 className="font-semibold font-mono">{tag}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-scada-accent">{value}</div>
            <div className="text-xs text-gray-400 mt-1">Current Value</div>
          </div>
          <div className="h-24 bg-scada-bg rounded p-2">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-500">Collecting data...</div>
            )}
          </div>
          <div className="text-[10px] text-gray-500 text-center">Last 60 seconds</div>
        </div>
      </div>
    </div>
  );
}
