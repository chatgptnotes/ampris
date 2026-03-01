import { useState, useEffect } from 'react';
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Gauge,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { api } from '@/services/api';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#E2E8F0',
};

interface VoltagePoint {
  timestamp: string;
  bus1Voltage: number;
  bus2Voltage: number;
  nominalKV: number;
  deviationBus1: number;
  deviationBus2: number;
}

interface PowerFactorPoint {
  timestamp: string;
  powerFactor: number;
  reactivePower: number;
  inPenaltyZone: boolean;
}

interface HarmonicData {
  order: number;
  magnitude: number;
  phase: number;
  limit: number;
  compliant: boolean;
}

interface ReliabilityIndex {
  period: string;
  saifi: number;
  saidi: number;
  caidi: number;
}

export default function AIPowerQuality() {
  const [loading, setLoading] = useState(true);
  const [voltage, setVoltage] = useState<VoltagePoint[]>([]);
  const [powerFactor, setPowerFactor] = useState<PowerFactorPoint[]>([]);
  const [harmonics, setHarmonics] = useState<{ thd: number; harmonics: HarmonicData[]; thdTrend: { timestamp: string; thd: number }[] }>({ thd: 0, harmonics: [], thdTrend: [] });
  const [reliability, setReliability] = useState<ReliabilityIndex[]>([]);
  const [activeTab, setActiveTab] = useState<'voltage' | 'pf' | 'harmonics' | 'reliability'>('voltage');
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setLoading(true);
    api.get('/ai/power-quality', { params: { hours } })
      .then(({ data }) => {
        setVoltage(data.voltageProfile);
        setPowerFactor(data.powerFactor);
        setHarmonics(data.harmonics);
        setReliability(data.reliability);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hours]);

  // Voltage stats
  const voltageStats = voltage.length > 0 ? {
    maxDevBus1: Math.max(...voltage.map(v => Math.abs(v.deviationBus1))),
    maxDevBus2: Math.max(...voltage.map(v => Math.abs(v.deviationBus2))),
    overVoltageEvents: voltage.filter(v => v.deviationBus1 > 5 || v.deviationBus2 > 5).length,
    underVoltageEvents: voltage.filter(v => v.deviationBus1 < -5 || v.deviationBus2 < -5).length,
  } : { maxDevBus1: 0, maxDevBus2: 0, overVoltageEvents: 0, underVoltageEvents: 0 };

  // PF stats
  const pfStats = powerFactor.length > 0 ? {
    avgPF: (powerFactor.reduce((s, p) => s + p.powerFactor, 0) / powerFactor.length),
    minPF: Math.min(...powerFactor.map(p => p.powerFactor)),
    penaltyHours: powerFactor.filter(p => p.inPenaltyZone).length,
    avgReactive: (powerFactor.reduce((s, p) => s + p.reactivePower, 0) / powerFactor.length),
  } : { avgPF: 0, minPF: 0, penaltyHours: 0, avgReactive: 0 };

  // Chart data formatters
  const voltageChartData = voltage.map(v => ({
    time: new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    bus1: v.bus1Voltage,
    bus2: v.bus2Voltage,
    devBus1: v.deviationBus1,
    devBus2: v.deviationBus2,
  }));

  const pfChartData = powerFactor.map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    pf: p.powerFactor,
    reactive: p.reactivePower,
    penalty: p.inPenaltyZone ? p.powerFactor : null,
  }));

  const thdChartData = harmonics.thdTrend.filter((_, i) => i % 4 === 0).map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    thd: t.thd,
  }));

  if (loading && voltage.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-scada-panel rounded animate-pulse w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-scada-panel rounded-lg animate-pulse" />)}
        </div>
        <div className="h-80 bg-scada-panel rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-scada-accent" />
          Power Quality Analytics
        </h2>
        <div className="flex items-center gap-2">
          {[24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`px-3 py-1 text-sm rounded ${hours === h ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}>
              {h === 168 ? '7D' : `${h}H`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['voltage', 'pf', 'harmonics', 'reliability'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded ${activeTab === tab ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}>
            {tab === 'voltage' ? 'Voltage' : tab === 'pf' ? 'Power Factor' : tab === 'harmonics' ? 'Harmonics' : 'Reliability'}
          </button>
        ))}
      </div>

      {/* Voltage Tab */}
      {activeTab === 'voltage' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Max Deviation Bus 1</div>
              <div className={`text-2xl font-bold font-mono ${voltageStats.maxDevBus1 > 5 ? 'text-red-400' : 'text-green-400'}`}>
                {voltageStats.maxDevBus1.toFixed(1)}%
              </div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Max Deviation Bus 2</div>
              <div className={`text-2xl font-bold font-mono ${voltageStats.maxDevBus2 > 5 ? 'text-red-400' : 'text-green-400'}`}>
                {voltageStats.maxDevBus2.toFixed(1)}%
              </div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Over-Voltage Events</div>
              <div className="text-2xl font-bold font-mono">{voltageStats.overVoltageEvents}</div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Under-Voltage Events</div>
              <div className="text-2xl font-bold font-mono">{voltageStats.underVoltageEvents}</div>
            </div>
          </div>

          {/* Voltage Profile */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Voltage Profile (kV)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={voltageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={Math.max(1, Math.floor(voltageChartData.length / 12))} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <ReferenceLine y={11.0} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Nominal 11kV', fill: '#10B981', fontSize: 10 }} />
                <ReferenceLine y={11.55} stroke="#DC2626" strokeDasharray="5 5" label={{ value: '+5%', fill: '#DC2626', fontSize: 9 }} />
                <ReferenceLine y={10.45} stroke="#DC2626" strokeDasharray="5 5" label={{ value: '-5%', fill: '#DC2626', fontSize: 9 }} />
                <Line type="monotone" dataKey="bus1" stroke="#3B82F6" strokeWidth={2} dot={false} name="Bus 1 (kV)" />
                <Line type="monotone" dataKey="bus2" stroke="#F97316" strokeWidth={2} dot={false} name="Bus 2 (kV)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Voltage Deviation */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Voltage Deviation from Nominal (%)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={voltageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={Math.max(1, Math.floor(voltageChartData.length / 12))} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <ReferenceLine y={0} stroke="#10B981" />
                <ReferenceLine y={5} stroke="#DC2626" strokeDasharray="3 3" />
                <ReferenceLine y={-5} stroke="#DC2626" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="devBus1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Bus 1 (%)" />
                <Area type="monotone" dataKey="devBus2" stroke="#F97316" fill="#F97316" fillOpacity={0.1} name="Bus 2 (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Power Factor Tab */}
      {activeTab === 'pf' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge className="w-3 h-3" /> Average PF</div>
              <div className={`text-2xl font-bold font-mono ${pfStats.avgPF >= 0.9 ? 'text-green-400' : 'text-red-400'}`}>
                {pfStats.avgPF.toFixed(3)}
              </div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Minimum PF</div>
              <div className={`text-2xl font-bold font-mono ${pfStats.minPF >= 0.9 ? 'text-green-400' : 'text-red-400'}`}>
                {pfStats.minPF.toFixed(3)}
              </div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> In Penalty Zone</div>
              <div className="text-2xl font-bold font-mono text-red-400">{pfStats.penaltyHours}h</div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Avg Reactive Power</div>
              <div className="text-2xl font-bold font-mono">{pfStats.avgReactive.toFixed(1)} MVAR</div>
            </div>
          </div>

          {/* PF Chart */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Power Factor Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pfChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={Math.max(1, Math.floor(pfChartData.length / 12))} />
                <YAxis yAxisId="pf" domain={[0.75, 1]} stroke="#10B981" fontSize={11} />
                <YAxis yAxisId="reactive" orientation="right" stroke="#8B5CF6" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <ReferenceLine yAxisId="pf" y={0.9} stroke="#DC2626" strokeDasharray="5 5" label={{ value: 'Penalty < 0.9', fill: '#DC2626', fontSize: 10 }} />
                <Line yAxisId="pf" type="monotone" dataKey="pf" stroke="#10B981" strokeWidth={2} dot={false} name="Power Factor" />
                <Line yAxisId="reactive" type="monotone" dataKey="reactive" stroke="#8B5CF6" strokeWidth={1.5} dot={false} name="Reactive (MVAR)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Capacitor Recommendation */}
          <div className="bg-blue-900/10 border border-blue-600/20 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Capacitor Bank Recommendation
            </h3>
            <div className="text-sm text-gray-300">
              Add <span className="text-blue-400 font-bold">50 kVAR</span> capacitor bank at Bus 2 to improve power factor from <span className="text-red-400 font-mono">0.85</span> to <span className="text-green-400 font-mono">0.95</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
              <div><span className="text-gray-400">Annual Penalty Savings:</span> <span className="text-green-400 font-mono">₹5.4L</span></div>
              <div><span className="text-gray-400">Loss Reduction:</span> <span className="text-green-400 font-mono">0.7%</span></div>
              <div><span className="text-gray-400">Payback Period:</span> <span className="text-yellow-400 font-mono">8 months</span></div>
            </div>
          </div>
        </>
      )}

      {/* Harmonics Tab */}
      {activeTab === 'harmonics' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total Harmonic Distortion</div>
              <div className={`text-2xl font-bold font-mono ${harmonics.thd > 8 ? 'text-red-400' : harmonics.thd > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                {harmonics.thd}%
              </div>
              <div className="text-xs text-gray-400">IEEE 519 limit: 8%</div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Non-Compliant Harmonics</div>
              <div className="text-2xl font-bold font-mono text-red-400">
                {harmonics.harmonics.filter(h => !h.compliant).length}
              </div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Worst Harmonic</div>
              <div className="text-2xl font-bold font-mono text-yellow-400">
                {harmonics.harmonics.length > 0 ? `${harmonics.harmonics.reduce((a, b) => a.magnitude > b.magnitude ? a : b).order}th (${harmonics.harmonics.reduce((a, b) => a.magnitude > b.magnitude ? a : b).magnitude}%)` : '--'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Individual Harmonics */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Individual Harmonic Magnitudes</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={harmonics.harmonics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="order" stroke="#94a3b8" fontSize={11} tickFormatter={v => `${v}th`} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="magnitude" name="Magnitude (%)">
                    {harmonics.harmonics.map((h, i) => (
                      <Cell key={i} fill={h.compliant ? '#3B82F6' : '#DC2626'} />
                    ))}
                  </Bar>
                  <Bar dataKey="limit" name="IEEE 519 Limit" fill="#10B981" fillOpacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-blue-400" /> Compliant</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Non-compliant</span>
              </div>
            </div>

            {/* THD Trend */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">THD Trend (7 Days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={thdChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={Math.max(1, Math.floor(thdChartData.length / 12))} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <ReferenceLine y={8} stroke="#DC2626" strokeDasharray="5 5" label={{ value: 'Limit 8%', fill: '#DC2626', fontSize: 10 }} />
                  <Area type="monotone" dataKey="thd" stroke="#EAB308" fill="#EAB308" fillOpacity={0.15} name="THD (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Harmonic Sources */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Harmonic Source Identification</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Dominant Harmonic</th>
                    <th className="px-3 py-2">Contribution</th>
                    <th className="px-3 py-2">Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-scada-border/30"><td className="px-3 py-2">VFD Drives (Feeder 1)</td><td className="px-3 py-2 font-mono">5th, 7th</td><td className="px-3 py-2 font-mono text-red-400">45%</td><td className="px-3 py-2 text-xs">Install passive harmonic filter</td></tr>
                  <tr className="border-b border-scada-border/30"><td className="px-3 py-2">UPS Systems (Feeder 2)</td><td className="px-3 py-2 font-mono">3rd, 9th</td><td className="px-3 py-2 font-mono text-orange-400">30%</td><td className="px-3 py-2 text-xs">Upgrade to active front-end UPS</td></tr>
                  <tr className="border-b border-scada-border/30"><td className="px-3 py-2">LED Lighting (Feeder 4)</td><td className="px-3 py-2 font-mono">3rd</td><td className="px-3 py-2 font-mono text-yellow-400">15%</td><td className="px-3 py-2 text-xs">Add neutral current filter</td></tr>
                  <tr className="border-b border-scada-border/30"><td className="px-3 py-2">Welding (Feeder 1)</td><td className="px-3 py-2 font-mono">5th, 11th</td><td className="px-3 py-2 font-mono text-green-400">10%</td><td className="px-3 py-2 text-xs">Schedule off-peak operation</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reliability Tab */}
      {activeTab === 'reliability' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {reliability.length > 0 && (
              <>
                <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">SAIFI (Current)</div>
                  <div className="text-2xl font-bold font-mono">{reliability[reliability.length - 1].saifi}</div>
                  <div className="text-xs text-gray-400">interruptions/customer/month</div>
                  <div className="text-xs text-gray-400 mt-1">Target: &lt; 1.0</div>
                </div>
                <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">SAIDI (Current)</div>
                  <div className="text-2xl font-bold font-mono">{reliability[reliability.length - 1].saidi}</div>
                  <div className="text-xs text-gray-400">hours/customer/month</div>
                  <div className="text-xs text-gray-400 mt-1">Target: &lt; 2.0</div>
                </div>
                <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">CAIDI (Current)</div>
                  <div className="text-2xl font-bold font-mono">{reliability[reliability.length - 1].caidi}</div>
                  <div className="text-xs text-gray-400">hours/interruption</div>
                  <div className="text-xs text-gray-400 mt-1">Target: &lt; 2.0</div>
                </div>
              </>
            )}
          </div>

          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Reliability Indices Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reliability}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <ReferenceLine y={1.0} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'SAIFI Target', fill: '#DC2626', fontSize: 9 }} />
                <ReferenceLine y={2.0} stroke="#F97316" strokeDasharray="3 3" label={{ value: 'SAIDI Target', fill: '#F97316', fontSize: 9 }} />
                <Line type="monotone" dataKey="saifi" stroke="#3B82F6" strokeWidth={2} name="SAIFI" />
                <Line type="monotone" dataKey="saidi" stroke="#F97316" strokeWidth={2} name="SAIDI" />
                <Line type="monotone" dataKey="caidi" stroke="#10B981" strokeWidth={2} name="CAIDI" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
