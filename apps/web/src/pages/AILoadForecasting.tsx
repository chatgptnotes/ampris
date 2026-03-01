import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Sun,
  Moon,
  Zap,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { api } from '@/services/api';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#E2E8F0',
};

const RANGES = [
  { label: '24H', value: '24h' },
  { label: '48H', value: '48h' },
  { label: '7D', value: '7d' },
];

interface ForecastPoint {
  timestamp: string;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  isHistorical?: boolean;
  actual?: number;
}

interface LoadDurationPoint {
  percentTime: number;
  loadMW: number;
}

interface DemandResponseRec {
  feeder: string;
  priority: number;
  currentLoadMW: number;
  sheddableLoadMW: number;
  customers: number;
  estimatedSavings: string;
  action: string;
}

export default function AILoadForecasting() {
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<{
    historical: ForecastPoint[];
    forecast: ForecastPoint[];
    peakPrediction: { value: number; time: string; confidence: number };
    factors: { name: string; impact: string; direction: 'up' | 'down' | 'neutral' }[];
  } | null>(null);
  const [loadDuration, setLoadDuration] = useState<LoadDurationPoint[]>([]);
  const [demandResponse, setDemandResponse] = useState<DemandResponseRec[]>([]);
  const [compareMode, setCompareMode] = useState<'none' | 'day_night' | 'weekday_weekend'>('none');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/ai/load-forecast', { params: { range } }),
      api.get('/ai/load-duration'),
      api.get('/ai/demand-response'),
    ])
      .then(([fcRes, ldRes, drRes]) => {
        setForecast(fcRes.data);
        setLoadDuration(ldRes.data);
        setDemandResponse(drRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!forecast) return [];
    const all = [
      ...forecast.historical.map(p => ({
        time: new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        fullTime: p.timestamp,
        actual: p.actual,
        predicted: undefined as number | undefined,
        upper: undefined as number | undefined,
        lower: undefined as number | undefined,
      })),
      ...forecast.forecast.map(p => ({
        time: new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        fullTime: p.timestamp,
        actual: undefined as number | undefined,
        predicted: p.predicted,
        upper: p.upperBound,
        lower: p.lowerBound,
      })),
    ];
    return all;
  }, [forecast]);

  // Day/Night comparison data
  const comparisonData = useMemo(() => {
    if (!forecast || compareMode === 'none') return null;

    const allPoints = [...forecast.historical, ...forecast.forecast];
    if (compareMode === 'day_night') {
      const dayPoints = allPoints.filter(p => {
        const h = new Date(p.timestamp).getHours();
        return h >= 6 && h < 18;
      });
      const nightPoints = allPoints.filter(p => {
        const h = new Date(p.timestamp).getHours();
        return h < 6 || h >= 18;
      });
      const dayAvg = dayPoints.length ? dayPoints.reduce((s, p) => s + (p.actual || p.predicted), 0) / dayPoints.length : 0;
      const nightAvg = nightPoints.length ? nightPoints.reduce((s, p) => s + (p.actual || p.predicted), 0) / nightPoints.length : 0;
      return [
        { name: 'Day (6AM-6PM)', avg: Math.round(dayAvg * 10) / 10, peak: Math.round(Math.max(...dayPoints.map(p => p.actual || p.predicted)) * 10) / 10, min: Math.round(Math.min(...dayPoints.map(p => p.actual || p.predicted)) * 10) / 10 },
        { name: 'Night (6PM-6AM)', avg: Math.round(nightAvg * 10) / 10, peak: Math.round(Math.max(...nightPoints.map(p => p.actual || p.predicted)) * 10) / 10, min: Math.round(Math.min(...nightPoints.map(p => p.actual || p.predicted)) * 10) / 10 },
      ];
    }
    return null;
  }, [forecast, compareMode]);

  const peakZone = forecast?.peakPrediction ? (
    forecast.peakPrediction.value > 28 ? 'critical' :
    forecast.peakPrediction.value > 25 ? 'warning' :
    forecast.peakPrediction.value > 20 ? 'normal' : 'low'
  ) : 'normal';

  const zoneColors: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-600/30' },
    normal: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-600/30' },
    warning: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-600/30' },
    critical: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-600/30' },
  };

  if (loading && !forecast) {
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
          <TrendingUp className="w-5 h-5 text-scada-accent" />
          AI Load Forecasting
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); setRange(r => r); }} className="p-1.5 rounded bg-scada-panel border border-scada-border text-gray-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-sm rounded ${range === r.value ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Peak Prediction Banner */}
      {forecast && (
        <div className={`${zoneColors[peakZone].bg} border ${zoneColors[peakZone].border} rounded-lg p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Zap className={`w-6 h-6 ${zoneColors[peakZone].text}`} />
            <div>
              <div className={`font-semibold ${zoneColors[peakZone].text}`}>
                Predicted Peak: {forecast.peakPrediction.value} MW at{' '}
                {new Date(forecast.peakPrediction.time).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
              <div className="text-xs text-gray-400">
                Confidence: {Math.round(forecast.peakPrediction.confidence * 100)}% | Zone: {peakZone.toUpperCase()}
              </div>
            </div>
          </div>
          {peakZone === 'critical' && (
            <div className="flex items-center gap-1 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Capacity threshold exceeded
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><TrendingUp className="w-4 h-4" /> Peak Load</div>
          <div className="text-2xl font-bold font-mono">{forecast?.peakPrediction.value || '--'} MW</div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><TrendingDown className="w-4 h-4" /> Min Load</div>
          <div className="text-2xl font-bold font-mono">
            {forecast ? Math.round(Math.min(...[...forecast.historical, ...forecast.forecast].map(p => p.actual || p.predicted)) * 10) / 10 : '--'} MW
          </div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><BarChart3 className="w-4 h-4" /> Avg Load</div>
          <div className="text-2xl font-bold font-mono">
            {forecast ? Math.round([...forecast.historical, ...forecast.forecast].reduce((s, p) => s + (p.actual || p.predicted), 0) / [...forecast.historical, ...forecast.forecast].length * 10) / 10 : '--'} MW
          </div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Clock className="w-4 h-4" /> Forecast Range</div>
          <div className="text-2xl font-bold font-mono">{range.toUpperCase()}</div>
        </div>
      </div>

      {/* Main Forecast Chart */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Load Forecast — Historical + Predicted</h3>
          <div className="flex gap-1">
            <button onClick={() => setCompareMode('none')} className={`text-xs px-2 py-1 rounded ${compareMode === 'none' ? 'bg-scada-accent text-white' : 'text-gray-400 hover:text-white'}`}>Normal</button>
            <button onClick={() => setCompareMode('day_night')} className={`text-xs px-2 py-1 rounded ${compareMode === 'day_night' ? 'bg-scada-accent text-white' : 'text-gray-400 hover:text-white'}`}>
              <Sun className="w-3 h-3 inline mr-1" />Day/Night
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={Math.max(1, Math.floor(chartData.length / 12))} />
            <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            <ReferenceLine y={28} stroke="#DC2626" strokeDasharray="5 5" label={{ value: 'Capacity 28MW', fill: '#DC2626', fontSize: 10 }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="#3B82F6" fillOpacity={0.08} name="Upper Bound" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#3B82F6" fillOpacity={0} name="Lower Bound" />
            <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} dot={false} name="Actual (MW)" connectNulls={false} />
            <Line type="monotone" dataKey="predicted" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted (MW)" connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Day/Night Comparison */}
      {comparisonData && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Day vs Night Load Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="avg" fill="#3B82F6" name="Average (MW)" />
              <Bar dataKey="peak" fill="#EAB308" name="Peak (MW)" />
              <Bar dataKey="min" fill="#10B981" name="Min (MW)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Factors & Load Duration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Factors affecting prediction */}
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Factors Affecting Prediction</h3>
          <div className="space-y-3">
            {forecast?.factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${f.direction === 'up' ? 'bg-red-400' : f.direction === 'down' ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-sm">{f.name}</span>
                </div>
                <span className={`text-xs font-mono ${f.direction === 'up' ? 'text-red-400' : f.direction === 'down' ? 'text-green-400' : 'text-gray-400'}`}>
                  {f.impact}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Load Duration Curve */}
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Load Duration Curve (30 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={loadDuration}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="percentTime" stroke="#94a3b8" fontSize={11} tickFormatter={v => `${v}%`} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} MW`, 'Load']} labelFormatter={v => `${v}% of time`} />
              <ReferenceArea x1={0} x2={12} fill="#DC2626" fillOpacity={0.05} />
              <Area type="monotone" dataKey="loadMW" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} name="Load (MW)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-400 mt-2">
            Load exceeds 25 MW for {loadDuration.filter(p => p.loadMW > 25).length}% of the time
          </div>
        </div>
      </div>

      {/* Demand Response Recommendations */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Demand Response Recommendations
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Feeder</th>
                <th className="px-3 py-2">Current Load</th>
                <th className="px-3 py-2">Sheddable</th>
                <th className="px-3 py-2">Customers</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {demandResponse.map(dr => (
                <tr key={dr.priority} className="border-b border-scada-border/30 hover:bg-scada-border/20">
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${dr.priority === 1 ? 'bg-red-900/30 text-red-400' : dr.priority === 2 ? 'bg-orange-900/30 text-orange-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                      P{dr.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{dr.feeder}</td>
                  <td className="px-3 py-2 font-mono">{dr.currentLoadMW} MW</td>
                  <td className="px-3 py-2 font-mono text-green-400">{dr.sheddableLoadMW} MW</td>
                  <td className="px-3 py-2 font-mono">{dr.customers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{dr.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
