import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import { useRealtimeStore } from '@/stores/realtimeStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Pause, Play, Search } from 'lucide-react';
import type { TrendData } from '@gridvision/shared';

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

const ZOOM_OPTIONS = [
  { label: '1min', ms: 60_000 },
  { label: '5min', ms: 300_000 },
  { label: '15min', ms: 900_000 },
  { label: '1hr', ms: 3_600_000 },
];

const HISTORY_RANGES = [
  { label: '1H', hours: 1 },
  { label: '6H', hours: 6 },
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
];

interface TagInfo {
  tag: string;
  type: string;
  unit?: string;
  description: string;
}

interface StreamPoint {
  time: number;
  [key: string]: number;
}

export default function Trends() {
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomMs, setZoomMs] = useState(300_000); // 5 minutes default
  const [paused, setPaused] = useState(false);
  const [streamData, setStreamData] = useState<StreamPoint[]>([]);

  // History mode state
  const [historyRange, setHistoryRange] = useState(24);
  const [historyData, setHistoryData] = useState<TrendData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);

  const values = useRealtimeStore((s) => s.values);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Fetch available tags from server
  useEffect(() => {
    api.get('/realtime/tags').then(({ data }) => {
      setAvailableTags(data.filter((t: TagInfo) => t.type === 'analog'));
    }).catch(() => {
      // Fallback: derive tags from current values
      const tags = Object.keys(values).map((tag) => ({
        tag,
        type: typeof values[tag]?.value === 'number' ? 'analog' : 'digital',
        description: tag,
      }));
      setAvailableTags(tags.filter((t) => t.type === 'analog'));
    });
  }, []);

  // Live streaming: collect data points from realtime store
  useEffect(() => {
    if (mode !== 'live' || selectedTags.length === 0) return;

    const interval = setInterval(() => {
      if (pausedRef.current) return;

      const now = Date.now();
      const point: StreamPoint = { time: now };
      for (const tag of selectedTags) {
        const val = useRealtimeStore.getState().values[tag];
        if (val && typeof val.value === 'number') {
          point[tag] = val.value;
        }
      }

      setStreamData((prev) => {
        const cutoff = now - zoomMs;
        const filtered = prev.filter((p) => p.time > cutoff);
        return [...filtered, point];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, selectedTags, zoomMs]);

  // History mode: fetch from historian API
  useEffect(() => {
    if (mode !== 'history' || selectedTags.length === 0) return;
    fetchHistoryFromRingBuffer();
  }, [mode, selectedTags, historyRange]);

  const fetchHistoryFromRingBuffer = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const to = Date.now();
      const from = to - historyRange * 60 * 60 * 1000;
      // Determine interval based on range
      const intervalMs = historyRange <= 1 ? 1000 : historyRange <= 6 ? 5000 : historyRange <= 24 ? 60000 : 300000;

      const { data } = await api.get('/historian/query', {
        params: {
          tags: selectedTags.join(','),
          from,
          to,
          interval: intervalMs,
        },
      });

      // Convert ring buffer format to TrendData-like format for charting
      const trendData: TrendData[] = selectedTags.map((tag) => ({
        dataPointId: tag,
        tag,
        unit: availableTags.find((t) => t.tag === tag)?.unit,
        points: (data[tag] || []).map((p: { time: number; value: number }) => ({
          time: new Date(p.time),
          avg: p.value,
          min: p.value,
          max: p.value,
        })),
      }));
      setHistoryData(trendData);
    } catch {
      // fallback: try DB-based trends
      try {
        if (selectedPointIds.length > 0) {
          const endTime = new Date().toISOString();
          const startTime = new Date(Date.now() - historyRange * 60 * 60 * 1000).toISOString();
          const { data } = await api.get<TrendData[]>('/trends/data', {
            params: { dataPointIds: selectedPointIds.join(','), startTime, endTime },
          });
          setHistoryData(data);
        }
      } catch { /* ignore */ }
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedTags, historyRange, selectedPointIds, availableTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 4) return prev; // max 4 tags
      return [...prev, tag];
    });
  };

  const filteredTags = useMemo(() => {
    if (!searchQuery) return availableTags;
    const q = searchQuery.toLowerCase();
    return availableTags.filter((t) =>
      t.tag.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [availableTags, searchQuery]);

  // Build chart data for history mode
  const historyChartData = useMemo(() => {
    if (historyData.length === 0) return [];
    const timeMap: Map<number, StreamPoint> = new Map();
    for (const series of historyData) {
      for (const point of series.points) {
        const t = new Date(point.time).getTime();
        const existing = timeMap.get(t) || { time: t };
        existing[series.tag] = point.avg;
        timeMap.set(t, existing);
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }, [historyData]);

  const chartData = mode === 'live' ? streamData : historyChartData;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">
          {mode === 'live' ? 'Live Trends' : 'Historical Trends'}
        </h2>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <button
            onClick={() => setMode('live')}
            className={`px-3 py-1 text-sm rounded ${mode === 'live' ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
          >
            Live
          </button>
          <button
            onClick={() => setMode('history')}
            className={`px-3 py-1 text-sm rounded ${mode === 'history' ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
          >
            History
          </button>

          <div className="w-px h-5 bg-scada-border" />

          {/* Zoom / Range controls */}
          {mode === 'live' ? (
            <>
              {ZOOM_OPTIONS.map((z) => (
                <button
                  key={z.label}
                  onClick={() => setZoomMs(z.ms)}
                  className={`px-2 py-1 text-xs rounded ${zoomMs === z.ms ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
                >
                  {z.label}
                </button>
              ))}
              <button
                onClick={() => setPaused(!paused)}
                className={`p-1.5 rounded ${paused ? 'bg-yellow-600 text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
                title={paused ? 'Resume' : 'Pause'}
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </>
          ) : (
            HISTORY_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setHistoryRange(r.hours)}
                className={`px-2 py-1 text-xs rounded ${historyRange === r.hours ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-1 overflow-hidden">
        {/* Tag Browser */}
        <div className="w-full sm:w-64 shrink-0 bg-scada-panel border border-scada-border rounded-lg flex flex-col overflow-hidden">
          <div className="p-2 border-b border-scada-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-scada-bg border border-scada-border rounded pl-8 pr-3 py-1.5 text-sm"
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {selectedTags.length}/4 tags selected
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {filteredTags.map((t) => (
              <button
                key={t.tag}
                onClick={() => toggleTag(t.tag)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
                  selectedTags.includes(t.tag) ? 'bg-scada-accent/20 text-scada-accent' : 'text-gray-400 hover:bg-scada-bg'
                } ${selectedTags.length >= 4 && !selectedTags.includes(t.tag) ? 'opacity-40' : ''}`}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: selectedTags.includes(t.tag)
                      ? COLORS[selectedTags.indexOf(t.tag)]
                      : '#6B7280',
                  }}
                />
                <div className="min-w-0">
                  <div className="font-mono truncate">{t.tag}</div>
                  <div className="text-[10px] text-gray-500 truncate">{t.description}{t.unit ? ` (${t.unit})` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 bg-scada-panel border border-scada-border rounded-lg p-4">
          {selectedTags.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select up to 4 tags from the panel to view trends
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading trend data...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {mode === 'live' ? 'Collecting data...' : 'No data for selected range'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) => {
                    const d = new Date(t);
                    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
                  }}
                  stroke="#64748B"
                  tick={{ fontSize: 10 }}
                />
                {selectedTags.map((tag, i) => (
                  <YAxis
                    key={tag}
                    yAxisId={tag}
                    orientation={i % 2 === 0 ? 'left' : 'right'}
                    stroke={COLORS[i]}
                    tick={{ fontSize: 10 }}
                    width={50}
                    domain={['auto', 'auto']}
                  />
                ))}
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(t) => new Date(t as number).toLocaleTimeString()}
                  formatter={(value: number) => [value.toFixed(3)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selectedTags.map((tag, i) => (
                  <Line
                    key={tag}
                    yAxisId={tag}
                    type="monotone"
                    dataKey={tag}
                    stroke={COLORS[i]}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
