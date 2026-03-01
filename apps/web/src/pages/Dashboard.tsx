import { useEffect, useState, useMemo } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { useAlarmStore } from '@/stores/alarmStore';
import { useNumericValue, useDigitalState } from '@/hooks/useRealTimeData';
import { api } from '@/services/api';
import type { Substation } from '@gridvision/shared';
import {
  Clock,
  Gauge,
  Thermometer,
  Zap,
  Activity,
  ToggleLeft,
  ToggleRight,
  Battery,
} from 'lucide-react';

export default function Dashboard() {
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [selectedSS, setSelectedSS] = useState<string | null>(null);
  const summary = useAlarmStore((s) => s.summary);
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);
  const lastLogin = localStorage.getItem('gridvision-last-login');

  useEffect(() => {
    api.get('/substations').then(({ data }) => {
      setSubstations(data);
      if (data.length > 0 && !selectedSS) setSelectedSS(data[0].id);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">System Dashboard</h2>
          {lastLogin && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <Clock className="w-3 h-3" />
              Last login: {new Date(lastLogin).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status Indicator */}
          <ConnectionBadge status={connectionStatus} />
          <select
            value={selectedSS || ''}
            onChange={(e) => setSelectedSS(e.target.value)}
            className="w-full sm:w-auto bg-scada-panel border border-scada-border rounded px-3 py-1.5 text-sm"
          >
            {substations.map((ss) => (
              <option key={ss.id} value={ss.id}>{ss.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Substations" value={substations.length} variant="normal" />
        <StatCard
          label="Active Alarms"
          value={summary.total}
          variant={summary.emergency > 0 ? 'danger' : summary.total > 0 ? 'warning' : 'normal'}
        />
        <StatCard
          label="Unacknowledged"
          value={summary.unacknowledged}
          variant={summary.unacknowledged > 0 ? 'warning' : 'normal'}
        />
        <StatCard
          label="Data Link"
          value={connectionStatus === 'connected' ? 'ONLINE' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          variant={connectionStatus === 'connected' ? 'success' : 'danger'}
        />
      </div>

      {/* Alarm Summary Bar */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <span className="text-sm text-gray-400 font-medium">Alarm Summary:</span>
          <AlarmCount label="Emergency" count={summary.emergency} color="bg-red-600" />
          <AlarmCount label="Urgent" count={summary.urgent} color="bg-orange-500" />
          <AlarmCount label="Normal" count={summary.normal} color="bg-yellow-500" />
          <AlarmCount label="Info" count={summary.info} color="bg-blue-500" />
        </div>
      </div>

      {/* 6 Live Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <SystemOverviewPanel />
        <VoltageMonitorPanel />
        <CurrentLoadPanel />
        <TransformerStatusPanel />
        <CircuitBreakerPanel />
        <EnergyMeterPanel />
      </div>
    </div>
  );
}

// ─────────────────── Connection Badge ───────────────────

function ConnectionBadge({ status }: { status: string }) {
  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
  };
  const labels = { connected: 'Connected', connecting: 'Connecting...', disconnected: 'Disconnected' };
  const color = colors[status as keyof typeof colors] || 'bg-gray-500';
  const label = labels[status as keyof typeof labels] || status;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

// ─────────────────── Panel 1: System Overview ───────────────────

function SystemOverviewPanel() {
  const freq = useNumericValue('SYS_FREQ', 2);
  const totalLoad = useNumericValue('SYS_TOTAL_LOAD', 2);
  const pf = useNumericValue('SYS_TOTAL_PF', 3);
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);

  return (
    <PanelCard title="System Overview" icon={<Activity className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-3">
        <LiveValue label="Frequency" value={freq} unit="Hz" tag="SYS_FREQ"
          status={getFreqStatus(parseFloat(freq))} />
        <LiveValue label="Total Load" value={totalLoad} unit="MW" tag="SYS_TOTAL_LOAD" />
        <LiveValue label="Power Factor" value={pf} unit="" tag="SYS_TOTAL_PF"
          status={getPfStatus(parseFloat(pf))} />
        <LiveValue label="Grid Status" value={connectionStatus === 'connected' ? 'NORMAL' : 'OFFLINE'}
          unit="" tag="" status={connectionStatus === 'connected' ? 'normal' : 'critical'} />
      </div>
    </PanelCard>
  );
}

// ─────────────────── Panel 2: Voltage Monitor ───────────────────

function VoltageMonitorPanel() {
  const v33RY = useNumericValue('INC_33KV_V_RY', 2);
  const v33YB = useNumericValue('INC_33KV_V_YB', 2);
  const v33BR = useNumericValue('INC_33KV_V_BR', 2);
  const busV = useNumericValue('BUS_11KV_V', 2);

  const feeders = useMemo(() => {
    const ids = [];
    for (let i = 1; i <= 6; i++) ids.push(`FDR${String(i).padStart(2, '0')}`);
    return ids;
  }, []);

  return (
    <PanelCard title="Voltage Monitor" icon={<Zap className="w-4 h-4" />}>
      <div className="space-y-2">
        <div className="text-xs text-gray-400 mb-1">33kV Incoming</div>
        <div className="grid grid-cols-3 gap-2">
          <VoltageBar label="R-Y" value={v33RY} nominal={33} />
          <VoltageBar label="Y-B" value={v33YB} nominal={33} />
          <VoltageBar label="B-R" value={v33BR} nominal={33} />
        </div>
        <div className="text-xs text-gray-400 mt-2 mb-1">11kV Bus & Feeders</div>
        <div className="grid grid-cols-4 gap-1.5">
          <VoltageBar label="Bus" value={busV} nominal={11} />
          {feeders.map((f) => (
            <FeederVoltageBar key={f} tag={`${f}_V`} label={`F${f.slice(-1)}`} />
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

function FeederVoltageBar({ tag, label }: { tag: string; label: string }) {
  const val = useNumericValue(tag, 2);
  return <VoltageBar label={label} value={val} nominal={11} />;
}

function VoltageBar({ label, value, nominal }: { label: string; value: string; nominal: number }) {
  const numVal = parseFloat(value);
  const pct = isNaN(numVal) ? 0 : (numVal / nominal) * 100;
  const deviation = isNaN(numVal) ? 0 : Math.abs((numVal - nominal) / nominal) * 100;
  const color = deviation > 5 ? 'bg-red-500' : deviation > 3 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="h-12 bg-scada-bg rounded relative overflow-hidden">
        <div className={`absolute bottom-0 w-full ${color} transition-all duration-500`}
          style={{ height: `${Math.min(100, Math.max(10, pct))}%` }} />
      </div>
      <div className="text-xs font-mono mt-0.5">{value === '---' ? '---' : `${value}`}</div>
    </div>
  );
}

// ─────────────────── Panel 3: Current / Load ───────────────────

function CurrentLoadPanel() {
  return (
    <PanelCard title="Current / Load" icon={<Gauge className="w-4 h-4" />}>
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <FeederCurrentBar key={i} index={i} />
        ))}
      </div>
    </PanelCard>
  );
}

function FeederCurrentBar({ index }: { index: number }) {
  const prefix = `FDR${String(index).padStart(2, '0')}`;
  const iR = useNumericValue(`${prefix}_I_R`, 1);
  const power = useNumericValue(`${prefix}_P`, 2);
  const numI = parseFloat(iR);
  const maxI = 300; // rated current
  const pct = isNaN(numI) ? 0 : (numI / maxI) * 100;
  const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-orange-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-8 shrink-0">F{index}</span>
      <div className="flex-1 h-4 bg-scada-bg rounded overflow-hidden relative">
        <div className={`h-full ${color} transition-all duration-500 rounded`}
          style={{ width: `${Math.min(100, pct)}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/80">
          {iR} A
        </span>
      </div>
      <span className="text-xs font-mono text-gray-400 w-14 text-right">{power} MW</span>
    </div>
  );
}

// ─────────────────── Panel 4: Transformer Status ───────────────────

function TransformerStatusPanel() {
  return (
    <PanelCard title="Transformer Status" icon={<Thermometer className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-3">
        <TransformerCard prefix="TR1" label="Transformer 1" />
        <TransformerCard prefix="TR2" label="Transformer 2" />
      </div>
    </PanelCard>
  );
}

function TransformerCard({ prefix, label }: { prefix: string; label: string }) {
  const oilTemp = useNumericValue(`${prefix}_OIL_TEMP`, 1);
  const wdgTemp = useNumericValue(`${prefix}_WDG_TEMP`, 1);
  const oilLevel = useNumericValue(`${prefix}_OIL_LEVEL`, 1);
  const tapPos = useNumericValue(`${prefix}_TAP_POS`, 0);
  const power = useNumericValue(`${prefix}_P_3PH`, 2);

  const oilTempNum = parseFloat(oilTemp);
  const tempColor = oilTempNum > 75 ? 'text-red-400' : oilTempNum > 60 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="bg-scada-bg rounded p-2 space-y-1.5">
      <div className="text-xs font-medium text-scada-accent">{label}</div>
      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div><span className="text-gray-400">Oil: </span><span className={`font-mono ${tempColor}`}>{oilTemp}°C</span></div>
        <div><span className="text-gray-400">Wdg: </span><span className="font-mono">{wdgTemp}°C</span></div>
        <div><span className="text-gray-400">Level: </span><span className="font-mono">{oilLevel}%</span></div>
        <div><span className="text-gray-400">Tap: </span><span className="font-mono">{tapPos}</span></div>
        <div className="col-span-2"><span className="text-gray-400">Load: </span><span className="font-mono">{power} MW</span></div>
      </div>
    </div>
  );
}

// ─────────────────── Panel 5: Circuit Breaker Status ───────────────────

function CircuitBreakerPanel() {
  const cbTags = useMemo(() => [
    { tag: 'INC_33KV_CB', label: '33kV INC' },
    { tag: 'TR1_HV_CB', label: 'TR1 HV' },
    { tag: 'TR1_LV_CB', label: 'TR1 LV' },
    { tag: 'TR2_HV_CB', label: 'TR2 HV' },
    { tag: 'TR2_LV_CB', label: 'TR2 LV' },
    { tag: 'BUS_TIE_CB', label: 'Bus Tie' },
    { tag: 'FDR01_CB', label: 'F1 CB' },
    { tag: 'FDR02_CB', label: 'F2 CB' },
    { tag: 'FDR03_CB', label: 'F3 CB' },
    { tag: 'FDR04_CB', label: 'F4 CB' },
    { tag: 'FDR05_CB', label: 'F5 CB' },
    { tag: 'FDR06_CB', label: 'F6 CB' },
  ], []);

  return (
    <PanelCard title="Circuit Breakers" icon={<ToggleRight className="w-4 h-4" />}>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {cbTags.map((cb) => (
          <CBIndicator key={cb.tag} tag={cb.tag} label={cb.label} />
        ))}
      </div>
    </PanelCard>
  );
}

function CBIndicator({ tag, label }: { tag: string; label: string }) {
  const state = useDigitalState(tag);
  const isClosed = state === true;
  const isOpen = state === false;
  // If undefined, show as unknown (gray)

  const bgColor = state === undefined
    ? 'bg-gray-700'
    : isClosed
      ? 'bg-green-900/50 border-green-700'
      : 'bg-red-900/50 border-red-700';

  const statusColor = state === undefined
    ? 'text-gray-500'
    : isClosed
      ? 'text-green-400'
      : 'text-red-400';

  const Icon = isClosed ? ToggleRight : ToggleLeft;

  return (
    <div className={`rounded border p-2 text-center ${bgColor}`}>
      <Icon className={`w-5 h-5 mx-auto ${statusColor}`} />
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
      <div className={`text-[10px] font-bold ${statusColor}`}>
        {state === undefined ? '---' : isClosed ? 'CLOSED' : 'OPEN'}
      </div>
    </div>
  );
}

// ─────────────────── Panel 6: Energy Meters ───────────────────

function EnergyMeterPanel() {
  const todayKwh = useNumericValue('ENERGY_TODAY_KWH', 0);
  const monthKwh = useNumericValue('ENERGY_MONTH_KWH', 0);
  const peakDemand = useNumericValue('PEAK_DEMAND_MW', 2);

  return (
    <PanelCard title="Energy Meters" icon={<Battery className="w-4 h-4" />}>
      <div className="space-y-3">
        <EnergyRow label="Today" value={todayKwh} unit="kWh" />
        <EnergyRow label="This Month" value={monthKwh} unit="kWh" />
        <EnergyRow label="Peak Demand" value={peakDemand} unit="MW" />
        <div className="border-t border-scada-border pt-2">
          <div className="text-xs text-gray-400 mb-1">Per-Feeder Energy (kWh)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <FeederEnergy key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

function FeederEnergy({ index }: { index: number }) {
  const tag = `FDR${String(index).padStart(2, '0')}_KWH`;
  const val = useNumericValue(tag, 0);
  return (
    <div className="bg-scada-bg rounded px-2 py-1 text-center">
      <div className="text-[10px] text-gray-400">F{index}</div>
      <div className="text-xs font-mono">{val}</div>
    </div>
  );
}

function EnergyRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-lg font-mono font-bold">
        {value} <span className="text-xs text-gray-400 font-normal">{unit}</span>
      </span>
    </div>
  );
}

// ─────────────────── Shared components ───────────────────

function PanelCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-scada-panel border border-scada-border rounded-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-scada-border">
        <span className="text-scada-accent">{icon}</span>
        <h3 className="text-sm font-medium">{title}</h3>
        <LastUpdated />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function LastUpdated() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <span className="ml-auto text-[10px] text-gray-500 font-mono">
      {new Date(now).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
    </span>
  );
}

function LiveValue({ label, value, unit, tag, status }: {
  label: string; value: string; unit: string; tag: string; status?: string;
}) {
  const statusColor = status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="bg-scada-bg rounded p-2">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`text-lg font-mono font-bold ${status ? statusColor : 'text-scada-text'} transition-all duration-300`}>
        {value}
        {unit && <span className="text-xs text-gray-400 font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, variant = 'normal' }: {
  label: string;
  value: number | string;
  variant?: 'normal' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    normal: 'text-scada-text',
    success: 'text-scada-success',
    warning: 'text-scada-warning',
    danger: 'text-scada-danger',
  };

  return (
    <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${colors[variant]}`}>{value}</div>
    </div>
  );
}

function AlarmCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded ${color} ${count > 0 ? 'animate-pulse' : 'opacity-30'}`} />
      <span className="text-sm">
        {label}: <span className="font-bold text-white">{count}</span>
      </span>
    </div>
  );
}

// ─────────────────── Helpers ───────────────────

function getFreqStatus(f: number): string {
  if (isNaN(f)) return 'normal';
  if (f < 49.5 || f > 50.5) return 'critical';
  if (f < 49.8 || f > 50.2) return 'warning';
  return 'normal';
}

function getPfStatus(pf: number): string {
  if (isNaN(pf)) return 'normal';
  if (pf < 0.85) return 'critical';
  if (pf < 0.90) return 'warning';
  return 'normal';
}
