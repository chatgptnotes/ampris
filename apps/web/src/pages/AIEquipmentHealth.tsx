import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ThermometerSun,
  Zap,
  Timer,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '@/services/api';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#E2E8F0',
};

interface EquipmentData {
  id: string;
  name: string;
  type: 'Transformer' | 'Circuit Breaker' | 'Motor' | 'Generator';
  healthScore: number;
  status: string;
  lastAnomaly: string | null;
  predictedFailureDate: string | null;
  operatingHours: number;
  age: number;
  details: Record<string, unknown>;
  anomalies: AnomalyItem[];
}

interface AnomalyItem {
  id: string;
  timestamp: string;
  severity: string;
  type: string;
  description: string;
  recommendedAction: string;
  affectedEquipment: string;
}

interface AlarmAnalysis {
  heatmap: { hour: number; dayOfWeek: number; count: number }[];
  topAlarms: { alarmType: string; source: string; count: number; severity: string }[];
  correlations: { alarmA: string; alarmB: string; probability: number; avgDelayMinutes: number; occurrences: number }[];
  storms: { startTime: string; endTime: string; alarmCount: number; peakRate: number; rootCause: string }[];
}

type SortField = 'healthScore' | 'name' | 'type';
type FilterType = 'all' | 'Transformer' | 'Circuit Breaker' | 'Motor' | 'Generator';

export default function AIEquipmentHealth() {
  const [equipment, setEquipment] = useState<EquipmentData[]>([]);
  const [alarmAnalysis, setAlarmAnalysis] = useState<AlarmAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('healthScore');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'equipment' | 'anomalies' | 'alarms'>('equipment');

  useEffect(() => {
    Promise.all([
      api.get('/ai/equipment-health'),
      api.get('/ai/alarm-analysis'),
    ])
      .then(([eqRes, alRes]) => {
        setEquipment(eqRes.data);
        setAlarmAnalysis(alRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let items = filterType === 'all' ? equipment : equipment.filter(e => e.type === filterType);
    items = [...items].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return items;
  }, [equipment, filterType, sortField, sortAsc]);

  const allAnomalies = useMemo(() =>
    equipment.flatMap(e => e.anomalies).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [equipment]
  );

  const statusCounts = useMemo(() => ({
    healthy: equipment.filter(e => e.status === 'healthy').length,
    degraded: equipment.filter(e => e.status === 'degraded').length,
    critical: equipment.filter(e => e.status === 'critical').length,
  }), [equipment]);

  // Alarm heatmap — build grid
  const heatmapGrid = useMemo(() => {
    if (!alarmAnalysis) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((dayName, dow) => {
      const row: Record<string, unknown> = { day: dayName };
      for (let h = 0; h < 24; h++) {
        const cell = alarmAnalysis.heatmap.find(c => c.dayOfWeek === dow && c.hour === h);
        row[`h${h}`] = cell?.count || 0;
      }
      return row;
    });
  }, [alarmAnalysis]);

  function healthColor(score: number): string {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function healthBg(score: number): string {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
      healthy: { bg: 'bg-green-900/30', text: 'text-green-400', icon: CheckCircle },
      degraded: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', icon: AlertTriangle },
      critical: { bg: 'bg-red-900/30', text: 'text-red-400', icon: XCircle },
      failed: { bg: 'bg-red-900/50', text: 'text-red-300', icon: XCircle },
    };
    const s = map[status] || map.healthy;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${s.bg} ${s.text}`}>
        <Icon className="w-3 h-3" />{status}
      </span>
    );
  }

  function severityBadge(severity: string) {
    const map: Record<string, string> = {
      critical: 'bg-red-900/30 text-red-400',
      warning: 'bg-yellow-900/30 text-yellow-400',
      info: 'bg-blue-900/30 text-blue-400',
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${map[severity] || map.info}`}>{severity}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-scada-panel rounded animate-pulse w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-scada-panel rounded-lg animate-pulse" />)}
        </div>
        <div className="h-96 bg-scada-panel rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-scada-accent" />
          Equipment Health & Anomaly Detection
        </h2>
        <div className="flex gap-1">
          {(['equipment', 'anomalies', 'alarms'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded capitalize ${activeTab === tab ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-400" />
          <div>
            <div className="text-2xl font-bold font-mono">{statusCounts.healthy}</div>
            <div className="text-xs text-gray-400">Healthy</div>
          </div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <div>
            <div className="text-2xl font-bold font-mono">{statusCounts.degraded}</div>
            <div className="text-xs text-gray-400">Degraded</div>
          </div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-400" />
          <div>
            <div className="text-2xl font-bold font-mono">{statusCounts.critical}</div>
            <div className="text-xs text-gray-400">Critical</div>
          </div>
        </div>
      </div>

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Filter:</span>
            {(['all', 'Transformer', 'Circuit Breaker', 'Motor', 'Generator'] as FilterType[]).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-2 py-1 text-xs rounded ${filterType === t ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border hover:text-white'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-4">Sort:</span>
            <button onClick={() => { setSortField('healthScore'); setSortAsc(s => sortField === 'healthScore' ? !s : true); }}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-scada-panel text-gray-400 border border-scada-border hover:text-white">
              <ArrowUpDown className="w-3 h-3" /> Health
            </button>
          </div>

          {/* Equipment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(eq => (
              <div key={eq.id} className="bg-scada-panel border border-scada-border rounded-lg p-4 hover:border-scada-accent/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-sm">{eq.name}</div>
                    <div className="text-xs text-gray-400">{eq.type} | {eq.operatingHours.toLocaleString()}h | {eq.age}yr</div>
                  </div>
                  {statusBadge(eq.status)}
                </div>

                {/* Health Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Health Score</span>
                    <span className={`font-bold font-mono ${healthColor(eq.healthScore)}`}>{eq.healthScore}%</span>
                  </div>
                  <div className="h-2 bg-scada-bg rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${healthBg(eq.healthScore)}`} style={{ width: `${eq.healthScore}%` }} />
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {eq.lastAnomaly && (
                    <div>
                      <span className="text-gray-400">Last Anomaly:</span>
                      <div className="text-yellow-400">{new Date(eq.lastAnomaly).toLocaleDateString()}</div>
                    </div>
                  )}
                  {eq.predictedFailureDate && (
                    <div>
                      <span className="text-gray-400">Pred. Failure:</span>
                      <div className="text-orange-400">{new Date(eq.predictedFailureDate).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>

                {/* Expandable details */}
                <button onClick={() => setExpandedId(expandedId === eq.id ? null : eq.id)}
                  className="flex items-center gap-1 text-xs text-scada-accent mt-3 hover:underline">
                  {expandedId === eq.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {eq.type === 'Transformer' ? 'Transformer Details' : eq.type === 'Circuit Breaker' ? 'CB Details' : 'Details'}
                </button>

                {expandedId === eq.id && (
                  <div className="mt-2 p-2 bg-scada-bg rounded text-xs space-y-1">
                    {eq.type === 'Transformer' && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400"><ThermometerSun className="w-3 h-3 inline" /> Oil Temp:</span><span>{(eq.details.oilTemp as number)}°C</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Tap Position:</span><span>{eq.details.tapPosition as number}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400"><Zap className="w-3 h-3 inline" /> Loading:</span><span>{eq.details.loadPercent as number}% of {eq.details.ratedMVA as number} MVA</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">DGA Status:</span><span className="text-green-400">{eq.details.dgaStatus as string}</span></div>
                      </>
                    )}
                    {eq.type === 'Circuit Breaker' && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400">Trip Count:</span><span>{eq.details.tripCount as number}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400"><Timer className="w-3 h-3 inline" /> Op. Time:</span><span>{eq.details.operatingTimeMs as number}ms (rated {eq.details.ratedOperatingTimeMs as number}ms)</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Contact Wear:</span><span className={`${(eq.details.contactWear as number) > 50 ? 'text-red-400' : 'text-green-400'}`}>{eq.details.contactWear as number}%</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Last Trip:</span><span>{eq.details.lastTripCause as string}</span></div>
                      </>
                    )}
                    {eq.type === 'Motor' && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400">Current:</span><span>{eq.details.current as number}A / {eq.details.ratedCurrent as number}A</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Temperature:</span><span>{eq.details.temperature as number}°C / {eq.details.ratedTemp as number}°C</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Vibration:</span><span className={`${eq.details.vibration === 'elevated' ? 'text-yellow-400' : 'text-green-400'}`}>{eq.details.vibration as string}</span></div>
                      </>
                    )}
                    {eq.type === 'Generator' && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400">Fuel Level:</span><span>{eq.details.fuelLevel as number}%</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Battery:</span><span>{eq.details.batteryVoltage as number}V</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Last Test:</span><span>{eq.details.testResult as string}</span></div>
                      </>
                    )}

                    {/* Anomalies for this equipment */}
                    {eq.anomalies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-scada-border">
                        <div className="font-medium text-yellow-400 mb-1">Anomalies:</div>
                        {eq.anomalies.map(a => (
                          <div key={a.id} className="mb-2 p-1.5 bg-scada-panel rounded">
                            <div className="flex items-center gap-1 mb-0.5">
                              {severityBadge(a.severity)}
                              <span className="text-gray-400">{new Date(a.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="text-gray-300">{a.description}</div>
                            <div className="text-scada-accent mt-0.5">{a.recommendedAction}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Anomalies Tab */}
      {activeTab === 'anomalies' && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">All Detected Anomalies ({allAnomalies.length})</h3>
          <div className="space-y-3">
            {allAnomalies.map(a => (
              <div key={a.id} className="p-3 bg-scada-bg rounded-lg border border-scada-border/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {severityBadge(a.severity)}
                    <span className="text-sm font-medium">{a.affectedEquipment}</span>
                    <span className="text-xs text-gray-400 font-mono">{a.type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{a.description}</p>
                <p className="text-sm text-scada-accent mt-1">{a.recommendedAction}</p>
              </div>
            ))}
            {allAnomalies.length === 0 && <div className="text-center text-gray-400 py-8">No anomalies detected</div>}
          </div>
        </div>
      )}

      {/* Alarms Tab */}
      {activeTab === 'alarms' && alarmAnalysis && (
        <div className="space-y-4">
          {/* Alarm Heatmap */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Alarm Heatmap — Hour of Day x Day of Week</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-gray-400">Day</th>
                    {Array.from({ length: 24 }, (_, h) => (
                      <th key={h} className="px-1 py-1 text-gray-500 font-mono">{String(h).padStart(2, '0')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapGrid.map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 text-gray-400 font-medium">{row.day as string}</td>
                      {Array.from({ length: 24 }, (_, h) => {
                        const count = row[`h${h}`] as number;
                        const opacity = Math.min(count / 8, 1);
                        return (
                          <td key={h} className="px-1 py-1">
                            <div
                              className="w-5 h-5 rounded-sm flex items-center justify-center"
                              style={{ backgroundColor: `rgba(59, 130, 246, ${opacity * 0.8 + 0.05})` }}
                              title={`${row.day as string} ${String(h).padStart(2, '0')}:00 — ${count} alarms`}
                            >
                              {count > 0 && <span className="text-[9px] text-white/80">{count}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 Alarms */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Top 10 Most Frequent Alarms</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alarmAnalysis.topAlarms} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="alarmType" type="category" stroke="#94a3b8" fontSize={10} width={120} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Count">
                    {alarmAnalysis.topAlarms.map((entry, i) => (
                      <Cell key={i} fill={entry.severity === 'critical' ? '#DC2626' : entry.severity === 'warning' ? '#EAB308' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Alarm Correlations */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Alarm Correlations</h3>
              <div className="space-y-3">
                {alarmAnalysis.correlations.map((c, i) => (
                  <div key={i} className="p-3 bg-scada-bg rounded-lg">
                    <div className="text-sm">
                      <span className="text-yellow-400">{c.alarmA}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="text-orange-400">{c.alarmB}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span>Probability: <span className="text-white font-mono">{Math.round(c.probability * 100)}%</span></span>
                      <span>Delay: <span className="text-white font-mono">{c.avgDelayMinutes < 1 ? `${Math.round(c.avgDelayMinutes * 60)}s` : `${c.avgDelayMinutes}min`}</span></span>
                      <span>Occurrences: <span className="text-white font-mono">{c.occurrences}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alarm Storms */}
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Alarm Storms Detected
            </h3>
            <div className="space-y-3">
              {alarmAnalysis.storms.map((storm, i) => (
                <div key={i} className="p-3 bg-red-900/10 border border-red-600/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-red-400">{storm.alarmCount} alarms in {Math.round((new Date(storm.endTime).getTime() - new Date(storm.startTime).getTime()) / 60000)} minutes</span>
                      <span className="text-xs text-gray-400 ml-2">Peak: {storm.peakRate}/min</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(storm.startTime).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    <span className="text-gray-400">Root Cause:</span> {storm.rootCause}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
