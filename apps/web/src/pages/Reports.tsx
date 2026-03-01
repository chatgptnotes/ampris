import { useState, useMemo } from 'react';
import { api } from '@/services/api';
import {
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type ReportType = 'daily-load' | 'alarm-summary';
type ChartType = 'line' | 'bar' | 'area' | 'pie';

const CHART_COLORS = ['#3B82F6', '#16A34A', '#EAB308', '#DC2626', '#F97316', '#8B5CF6', '#06B6D4', '#EC4899'];

function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumXX = data.reduce((s, d) => s + d.x * d.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('daily-load');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [reportData, setReportData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubstation, setSelectedSubstation] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('load');
  const [showPredictions, setShowPredictions] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'daily-load') {
        const { data } = await api.get('/reports/daily-load', {
          params: { substationId: selectedSubstation, date: endDate },
        });
        setReportData(data);
      } else {
        const startTime = new Date(startDate);
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date(endDate);
        endTime.setHours(23, 59, 59, 999);
        const { data } = await api.get('/reports/alarm-summary', {
          params: { startTime: startTime.toISOString(), endTime: endTime.toISOString() },
        });
        setReportData(data);
      }
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate sample chart data from report data or fallback
  const chartData = useMemo(() => {
    if (reportData && typeof reportData === 'object') {
      const rd = reportData as Record<string, unknown>;
      if (Array.isArray(rd.data)) return rd.data;
      if (Array.isArray(rd.hourly)) return rd.hourly;
    }
    // Fallback demo data for visualization
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      load: Math.round(40 + Math.random() * 60),
      voltage: Math.round(320 + Math.random() * 30),
      current: Math.round(100 + Math.random() * 150),
    }));
  }, [reportData]);

  const predictionData = useMemo(() => {
    if (!showPredictions || chartData.length < 2) return chartData;
    const numericData = chartData.map((d: Record<string, unknown>, i: number) => ({
      x: i,
      y: Number((d as Record<string, unknown>)[selectedMetric] ?? (d as Record<string, unknown>).load ?? 0),
    }));
    const { slope, intercept } = linearRegression(numericData);
    const extended = [...chartData];
    for (let i = 1; i <= 6; i++) {
      const idx = chartData.length + i - 1;
      const predicted = Math.round(slope * idx + intercept);
      extended.push({
        hour: `+${i}h`,
        load: predicted,
        voltage: predicted,
        current: predicted,
        predicted: true,
      } as Record<string, unknown>);
    }
    return extended;
  }, [chartData, showPredictions, selectedMetric]);

  const exportCSV = () => {
    if (!chartData.length) return;
    const headers = Object.keys(chartData[0] as Record<string, unknown>).join(',');
    const rows = chartData.map((d: unknown) => Object.values(d as Record<string, unknown>).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportType}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    window.print();
  };

  const renderChart = (): React.ReactNode => {
    const data = showPredictions ? predictionData : chartData;
    const dataKey = selectedMetric === 'load' ? 'load' : selectedMetric === 'voltage' ? 'voltage' : 'current';

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Bar dataKey={dataKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Area type="monotone" dataKey={dataKey} stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.slice(0, 8)} dataKey={dataKey} nameKey="hour" cx="50%" cy="50%" outerRadius={100} label>
                {data.slice(0, 8).map((_: unknown, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }} />
              <Legend />
              <Line type="monotone" dataKey={dataKey} stroke="#3B82F6" strokeWidth={2} dot={false} />
              {showPredictions && (
                <Line type="monotone" dataKey={dataKey} stroke="#F97316" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted" />
              )}
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2 className="text-xl font-semibold">Reports</h2>

      {/* Report Configuration */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="text-xs text-gray-400 block mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
            >
              <option value="daily-load">Daily Load Report</option>
              <option value="alarm-summary">Alarm Summary Report</option>
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-xs text-gray-400 block mb-1">Substation</label>
            <select
              value={selectedSubstation}
              onChange={(e) => setSelectedSubstation(e.target.value)}
              className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
            >
              <option value="all">All Substations</option>
              <option value="waluj">Waluj 33/11kV</option>
              <option value="cidco">CIDCO 132/33kV</option>
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-xs text-gray-400 block mb-1">Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
            >
              <option value="load">Load (MW)</option>
              <option value="voltage">Voltage (kV)</option>
              <option value="current">Current (A)</option>
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-end gap-2 w-full sm:w-auto">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-scada-accent hover:bg-blue-600 text-white rounded text-sm"
            >
              <FileText className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Chart Type:</span>
            {(['line', 'bar', 'area', 'pie'] as ChartType[]).map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-3 py-1 text-xs rounded capitalize ${
                  chartType === ct
                    ? 'bg-scada-accent text-white'
                    : 'bg-scada-bg text-gray-400 border border-scada-border hover:text-white'
                }`}
              >
                {ct === 'line' && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{ct}</span>}
                {ct === 'bar' && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{ct}</span>}
                {ct !== 'line' && ct !== 'bar' && ct}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPredictions}
                onChange={(e) => setShowPredictions(e.target.checked)}
                className="rounded"
              />
              Show Predictions
            </label>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1 px-3 py-1 bg-scada-bg border border-scada-border rounded text-xs hover:bg-scada-border/50"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-1 px-3 py-1 bg-scada-bg border border-scada-border rounded text-xs hover:bg-scada-border/50"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-scada-accent" />
          {reportType === 'daily-load' ? 'Load Profile' : 'Alarm Distribution'}
          {showPredictions && <span className="text-xs text-orange-400 ml-2">(with 6h prediction)</span>}
        </h3>
        {renderChart()}
      </div>

      {/* Predictive Analytics */}
      {showPredictions && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Predictive Analytics — Linear Regression
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PredictionCard
              label="Next Hour"
              value={(() => {
                const numericData = chartData.map((d: Record<string, unknown>, i: number) => ({
                  x: i,
                  y: Number((d as Record<string, unknown>)[selectedMetric] ?? (d as Record<string, unknown>).load ?? 0),
                }));
                const { slope, intercept } = linearRegression(numericData);
                return Math.round(slope * chartData.length + intercept);
              })()}
              unit={selectedMetric === 'load' ? 'MW' : selectedMetric === 'voltage' ? 'kV' : 'A'}
              trend="up"
            />
            <PredictionCard
              label="3-Hour Forecast"
              value={(() => {
                const numericData = chartData.map((d: Record<string, unknown>, i: number) => ({
                  x: i,
                  y: Number((d as Record<string, unknown>)[selectedMetric] ?? (d as Record<string, unknown>).load ?? 0),
                }));
                const { slope, intercept } = linearRegression(numericData);
                return Math.round(slope * (chartData.length + 2) + intercept);
              })()}
              unit={selectedMetric === 'load' ? 'MW' : selectedMetric === 'voltage' ? 'kV' : 'A'}
              trend="up"
            />
            <PredictionCard
              label="6-Hour Forecast"
              value={(() => {
                const numericData = chartData.map((d: Record<string, unknown>, i: number) => ({
                  x: i,
                  y: Number((d as Record<string, unknown>)[selectedMetric] ?? (d as Record<string, unknown>).load ?? 0),
                }));
                const { slope, intercept } = linearRegression(numericData);
                return Math.round(slope * (chartData.length + 5) + intercept);
              })()}
              unit={selectedMetric === 'load' ? 'MW' : selectedMetric === 'voltage' ? 'kV' : 'A'}
              trend="stable"
            />
          </div>
        </div>
      )}

      {/* Raw Report Data */}
      {reportData && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Raw Report Data</h3>
          </div>
          <pre className="text-xs font-mono bg-scada-bg p-4 rounded overflow-auto max-h-60">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function PredictionCard({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="bg-scada-bg border border-scada-border rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold font-mono text-orange-400">{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
        <TrendingUp
          className={`w-4 h-4 ml-auto ${
            trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-yellow-400'
          }`}
        />
      </div>
    </div>
  );
}
