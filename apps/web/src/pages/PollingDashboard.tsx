import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Radio, Play, Square, RefreshCw, AlertTriangle, Activity, Clock, Gauge } from 'lucide-react';

interface DeviceStatus {
  deviceId: string;
  deviceName: string;
  protocol: string;
  status: 'polling' | 'stopped' | 'error';
  lastPoll: string | null;
  lastError: string | null;
  tagCount: number;
  pollRate: number;
  avgLatencyMs: number;
  totalPolls: number;
  totalErrors: number;
  startedAt: string | null;
}

interface PollStats {
  totalDevices: number;
  activeDevices: number;
  totalPolls: number;
  totalErrors: number;
  avgLatencyMs: number;
  totalTagsPolled: number;
  totalReadsPerSec: number;
  errorRate: number;
  uptime: number;
}

interface ErrorEntry {
  deviceId: string;
  deviceName: string;
  error: string;
  timestamp: string;
}

export default function PollingDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [stats, setStats] = useState<PollStats | null>(null);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, statsRes, errorsRes] = await Promise.all([
        api.get('/polling/status'),
        api.get('/polling/stats'),
        api.get('/polling/errors'),
      ]);
      setDevices(statusRes.data);
      setStats(statsRes.data);
      setErrors(errorsRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const startAll = async () => {
    setLoading(true);
    try { await api.post('/polling/start', { projectId }); } catch {}
    setLoading(false);
    fetchData();
  };

  const stopAll = async () => {
    setLoading(true);
    try { await api.post('/polling/stop'); } catch {}
    setLoading(false);
    fetchData();
  };

  const startDevice = async (deviceId: string) => {
    try { await api.post(`/polling/device/${deviceId}/start`); } catch {}
    fetchData();
  };

  const stopDevice = async (deviceId: string) => {
    try { await api.post(`/polling/device/${deviceId}/stop`); } catch {}
    fetchData();
  };

  const statusIcon = (status: string) => {
    if (status === 'polling') return <span className="text-green-400">🟢</span>;
    if (status === 'error') return <span className="text-yellow-400">🟡</span>;
    return <span className="text-red-400">🔴</span>;
  };

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Polling Engine</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={startAll} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
            <Play className="w-4 h-4" /> Start All
          </button>
          <button onClick={stopAll} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
            <Square className="w-4 h-4" /> Stop All
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Active Devices', value: `${stats.activeDevices}/${stats.totalDevices}`, icon: Activity },
            { label: 'Tags Polled', value: stats.totalTagsPolled, icon: Radio },
            { label: 'Reads/sec', value: stats.totalReadsPerSec, icon: Gauge },
            { label: 'Avg Latency', value: `${stats.avgLatencyMs}ms`, icon: Clock },
            { label: 'Error Rate', value: `${stats.errorRate}%`, icon: AlertTriangle },
            { label: 'Uptime', value: formatUptime(stats.uptime), icon: RefreshCw },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <s.icon className="w-3 h-3" /> {s.label}
              </div>
              <div className="text-white text-lg font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d) => (
          <div key={d.deviceId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {statusIcon(d.status)}
                <span className="text-white font-medium">{d.deviceName}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">{d.protocol}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-gray-400">Status: <span className="text-white capitalize">{d.status}</span></div>
              <div className="text-gray-400">Tags: <span className="text-white">{d.tagCount}</span></div>
              <div className="text-gray-400">Rate: <span className="text-white">{d.pollRate} r/s</span></div>
              <div className="text-gray-400">Latency: <span className="text-white">{d.avgLatencyMs}ms</span></div>
              <div className="text-gray-400">Polls: <span className="text-white">{d.totalPolls}</span></div>
              <div className="text-gray-400">Errors: <span className="text-red-400">{d.totalErrors}</span></div>
            </div>
            {d.lastPoll && (
              <div className="text-xs text-gray-500 mb-2">Last: {new Date(d.lastPoll).toLocaleTimeString()}</div>
            )}
            {d.lastError && (
              <div className="text-xs text-red-400 mb-2 truncate">{d.lastError}</div>
            )}
            <div className="flex gap-2">
              {d.status === 'stopped' || d.status === 'error' ? (
                <button onClick={() => startDevice(d.deviceId)} className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs">
                  Start
                </button>
              ) : (
                <button onClick={() => stopDevice(d.deviceId)} className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs">
                  Stop
                </button>
              )}
            </div>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-12">
            No devices configured. Add devices in Device Manager, then start polling.
          </div>
        )}
      </div>

      {/* Error Log */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 p-4 border-b border-gray-700">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <h2 className="text-white font-medium">Error Log</h2>
          <span className="text-xs text-gray-500">Last 50</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {errors.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">No errors</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs bg-gray-900/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Device</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} className="border-t border-gray-700/50">
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2 text-white">{e.deviceName}</td>
                    <td className="px-4 py-2 text-red-400 truncate max-w-xs">{e.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
