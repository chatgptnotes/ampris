import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
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
} from 'recharts';
import { api } from '@/services/api';

const TIME_RANGES = [
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: '30D', hours: 720 },
  { label: '90D', hours: 2160 },
];

// Fallback demo data generator (used when API unavailable)
function generateDemoData(hours: number) {
  const points = Math.min(hours, 48);
  const interval = hours / points;
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(Date.now() - (points - i) * interval * 3600000);
    return {
      time: hours <= 24
        ? t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
        : t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      load: Math.round(45 + Math.sin(i / 4) * 20 + Math.random() * 10),
      peakDemand: Math.round(65 + Math.cos(i / 3) * 15 + Math.random() * 8),
      powerFactor: +(0.85 + Math.sin(i / 6) * 0.1 + Math.random() * 0.05).toFixed(2),
      efficiency: +(92 + Math.sin(i / 5) * 4 + Math.random() * 2).toFixed(1),
    };
  });
}

function generateAlarmTrend(hours: number) {
  const points = Math.min(hours / (hours <= 24 ? 1 : 24), 30);
  return Array.from({ length: points }, (_, i) => ({
    period: `${i + 1}`,
    critical: Math.floor(Math.random() * 3),
    major: Math.floor(Math.random() * 5),
    minor: Math.floor(Math.random() * 8),
    warning: Math.floor(Math.random() * 12),
  }));
}

function generateSubstationComparison() {
  return [
    { name: 'Waluj 33/11kV', load: 72, alarms: 5, availability: 99.2 },
    { name: 'CIDCO 132/33kV', load: 85, alarms: 3, availability: 98.8 },
    { name: 'Jalna 33/11kV', load: 61, alarms: 8, availability: 97.5 },
    { name: 'Parbhani 33/11kV', load: 54, alarms: 2, availability: 99.6 },
  ];
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState(24);
  const [data, setData] = useState<any[]>([]);
  const [alarmTrend, setAlarmTrend] = useState<any[]>([]);
  const [substationComparison, setSubstationComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const { data: resp } = await api.get('/analytics', { params: { hours: timeRange } });
        if (!cancelled && resp) {
          setData(resp.loadTrend || generateDemoData(timeRange));
          setAlarmTrend(resp.alarmTrend || generateAlarmTrend(timeRange));
          setSubstationComparison(resp.substationComparison || generateSubstationComparison());
        }
      } catch {
        if (!cancelled) {
          setData(generateDemoData(timeRange));
          setAlarmTrend(generateAlarmTrend(timeRange));
          setSubstationComparison(generateSubstationComparison());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => { cancelled = true; };
  }, [timeRange]);

  const avgLoad = useMemo(() => data.length ? Math.round(data.reduce((s, d) => s + (d.load || 0), 0) / data.length) : 0, [data]);
  const peakDemand = useMemo(() => data.length ? Math.max(...data.map((d) => d.peakDemand || 0)) : 0, [data]);
  const avgPF = useMemo(() => data.length ? +(data.reduce((s, d) => s + (d.powerFactor || 0), 0) / data.length).toFixed(2) : 0, [data]);
  const avgEfficiency = useMemo(
    () => data.length ? +(data.reduce((s, d) => s + (d.efficiency || 0), 0) / data.length).toFixed(1) : 0,
    [data]
  );

  return (
    <div className="space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-scada-accent" />
          Analytics Dashboard
        </h2>
        <div className="flex items-center gap-2">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.label}
              onClick={() => setTimeRange(tr.hours)}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === tr.hours
                  ? 'bg-scada-accent text-white'
                  : 'bg-scada-panel text-gray-400 border border-scada-border'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Zap} label="Average Load" value={`${avgLoad} MW`} change={+3.2} color="text-scada-accent" />
        <KPICard icon={TrendingUp} label="Peak Demand" value={`${peakDemand} MW`} change={+1.8} color="text-scada-warning" />
        <KPICard icon={Gauge} label="Avg Power Factor" value={String(avgPF)} change={-0.5} color="text-scada-success" />
        <KPICard icon={BarChart3} label="System Efficiency" value={`${avgEfficiency}%`} change={+0.3} color="text-purple-400" />
      </div>

      {/* Load Trend Chart */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Load & Peak Demand Trend</h3>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center text-gray-500">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Area type="monotone" dataKey="load" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} name="Avg Load (MW)" />
              <Area type="monotone" dataKey="peakDemand" stroke="#EAB308" fill="#EAB308" fillOpacity={0.1} name="Peak Demand (MW)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alarm Trend */}
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Alarm Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={alarmTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Bar dataKey="critical" stackId="a" fill="#DC2626" name="Critical" />
              <Bar dataKey="major" stackId="a" fill="#F97316" name="Major" />
              <Bar dataKey="minor" stackId="a" fill="#EAB308" name="Minor" />
              <Bar dataKey="warning" stackId="a" fill="#3B82F6" name="Warning" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Power Factor & Efficiency */}
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Power Factor & Efficiency</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="pf" domain={[0.7, 1]} stroke="#16A34A" fontSize={11} />
              <YAxis yAxisId="eff" orientation="right" domain={[85, 100]} stroke="#8B5CF6" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Line yAxisId="pf" type="monotone" dataKey="powerFactor" stroke="#16A34A" strokeWidth={2} dot={false} name="Power Factor" />
              <Line yAxisId="eff" type="monotone" dataKey="efficiency" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Efficiency (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Substation Comparison */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Substation Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                <th className="px-4 py-2">Substation</th>
                <th className="px-4 py-2">Load (%)</th>
                <th className="px-4 py-2">Active Alarms</th>
                <th className="px-4 py-2">Availability (%)</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {substationComparison.map((ss) => (
                <tr key={ss.name} className="border-b border-scada-border/30 hover:bg-scada-border/20">
                  <td className="px-4 py-2 font-medium">{ss.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-scada-bg rounded-full max-w-[120px]">
                        <div
                          className={`h-2 rounded-full ${ss.load > 80 ? 'bg-red-500' : ss.load > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${ss.load}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs">{ss.load}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-mono ${ss.alarms > 5 ? 'text-red-400' : ss.alarms > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {ss.alarms}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono">{ss.availability}%</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${ss.availability > 99 ? 'bg-green-900/30 text-green-400' : ss.availability > 98 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-red-900/30 text-red-400'}`}>
                      {ss.availability > 99 ? 'Healthy' : ss.availability > 98 ? 'Degraded' : 'At Risk'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  change,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change: number;
  color: string;
}) {
  const isPositive = change > 0;
  return (
    <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <div className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}%
        </div>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
