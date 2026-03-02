import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Activity, Wifi, WifiOff, RotateCcw, Search, Radio, ArrowUpDown, Zap } from 'lucide-react';

interface DeviceStat {
  deviceId: string;
  deviceName: string;
  protocol: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  lastError: string | null;
  lastErrorAt: string | null;
  bytesReceived: number;
  bytesSent: number;
}

interface NetworkNode {
  deviceId: string;
  deviceName: string;
  protocol: string;
  status: string;
  successRate: number;
  avgLatencyMs: number;
  errorCount: number;
}

interface FrameLog {
  direction: string;
  rawData: string;
  parsed: any;
  status: string;
  latencyMs?: number;
  errorDetail?: string;
}

export default function CommDiagnostics() {
  const { projectId } = useParams<{ projectId: string }>();
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [networkMap, setNetworkMap] = useState<NetworkNode[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<FrameLog[]>([]);
  const [pingResult, setPingResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [summaryRes, mapRes] = await Promise.all([
        api.get('/diagnostics/summary', { params: { projectId } }),
        api.get('/diagnostics/network-map', { params: { projectId } }),
      ]);
      setDevices(summaryRes.data);
      setNetworkMap(mapRes.data);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchDeviceLogs = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    try {
      const res = await api.get(`/diagnostics/device/${deviceId}/logs`, { params: { limit: 100 } });
      setDeviceLogs(res.data);
    } catch {}
  };

  const pingDevice = async (deviceId: string) => {
    try {
      const res = await api.post(`/diagnostics/device/${deviceId}/ping`);
      setPingResult(res.data);
    } catch {}
  };

  const resetAll = async () => {
    try { await api.post('/diagnostics/reset'); fetchData(); } catch {}
  };

  const totalDevices = devices.length;
  const onlineDevices = networkMap.filter((n) => n.status === 'online').length;
  const totalReads = devices.reduce((s, d) => s + d.totalRequests, 0);
  const overallErrorRate = totalReads > 0 ? Math.round((devices.reduce((s, d) => s + d.errorCount, 0) / totalReads) * 10000) / 100 : 0;

  const statusColor = (status: string) => {
    if (status === 'online') return 'text-green-400';
    if (status === 'error') return 'text-red-400';
    return 'text-gray-500';
  };

  const lineColor = (status: string) => {
    if (status === 'online') return '#22c55e';
    if (status === 'error') return '#ef4444';
    return '#6b7280';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Communication Diagnostics</h1>
        </div>
        <button onClick={resetAll} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Reset Counters
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="text-gray-400 text-xs">Total Devices</div>
          <div className="text-white text-xl font-bold">{totalDevices}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="text-gray-400 text-xs">Online</div>
          <div className="text-green-400 text-xl font-bold">{onlineDevices}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="text-gray-400 text-xs">Total Requests</div>
          <div className="text-white text-xl font-bold">{totalReads.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="text-gray-400 text-xs">Error Rate</div>
          <div className={`text-xl font-bold ${overallErrorRate > 5 ? 'text-red-400' : 'text-green-400'}`}>{overallErrorRate}%</div>
        </div>
      </div>

      {/* Network Topology */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2"><Radio className="w-4 h-4" /> Network Topology</h3>
        <div className="flex items-start gap-8">
          {/* Server node */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-xl bg-blue-900/30 border-2 border-blue-500 flex items-center justify-center">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <span className="text-xs text-blue-400 mt-1">SCADA Server</span>
          </div>

          {/* Connection lines + devices */}
          <div className="flex flex-col gap-3 flex-1">
            {networkMap.map((node) => (
              <div key={node.deviceId} className="flex items-center gap-3 cursor-pointer hover:bg-gray-700/20 p-2 rounded" onClick={() => fetchDeviceLogs(node.deviceId)}>
                <svg width="60" height="4">
                  <line x1="0" y1="2" x2="60" y2="2" stroke={lineColor(node.status)} strokeWidth="2" />
                </svg>
                <div className={`flex items-center gap-2 ${statusColor(node.status)}`}>
                  {node.status === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{node.deviceName}</div>
                  <div className="text-gray-500 text-xs">{node.protocol}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    <span className={node.successRate > 95 ? 'text-green-400' : node.successRate > 80 ? 'text-yellow-400' : 'text-red-400'}>
                      {node.successRate}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{node.avgLatencyMs}ms</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); pingDevice(node.deviceId); }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">
                  Ping
                </button>
              </div>
            ))}
            {networkMap.length === 0 && (
              <div className="text-gray-500 text-sm">No devices reporting. Start polling engine first.</div>
            )}
          </div>
        </div>
      </div>

      {/* Ping Result */}
      {pingResult && (
        <div className={`rounded-lg p-3 border ${pingResult.success ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'}`}>
          <span className={pingResult.success ? 'text-green-400' : 'text-red-400'}>
            {pingResult.message} ({pingResult.latencyMs}ms)
          </span>
        </div>
      )}

      {/* Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d) => {
          const successRate = d.totalRequests > 0 ? Math.round((d.successCount / d.totalRequests) * 10000) / 100 : 0;
          const throughput = Math.round((d.bytesReceived + d.bytesSent) / 1024);
          return (
            <div key={d.deviceId} className="bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-gray-600" onClick={() => fetchDeviceLogs(d.deviceId)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">{d.deviceName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{d.protocol}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Success: <span className={successRate > 95 ? 'text-green-400' : 'text-red-400'}>{successRate}%</span></div>
                <div className="text-gray-400">Latency: <span className="text-white">{Math.round(d.avgLatencyMs)}ms</span></div>
                <div className="text-gray-400">Errors: <span className="text-red-400">{d.errorCount}</span></div>
                <div className="text-gray-400">Throughput: <span className="text-white">{throughput}KB</span></div>
                <div className="text-gray-400">TX: <span className="text-blue-400">{d.bytesSent}</span></div>
                <div className="text-gray-400">RX: <span className="text-green-400">{d.bytesReceived}</span></div>
              </div>
              {d.lastError && (
                <div className="text-xs text-red-400 mt-2 truncate">{d.lastError}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Device Log Drill-down */}
      {selectedDevice && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-white font-medium flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" /> Communication Log
            </h3>
            <button onClick={() => setSelectedDevice(null)} className="text-gray-400 hover:text-white text-sm">Close</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {deviceLogs.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">No logs yet</div>
            ) : (
              <table className="w-full text-xs font-mono">
                <thead className="text-gray-400 bg-gray-900/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Dir</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Raw Data (hex)</th>
                    <th className="px-3 py-2 text-left">Parsed</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceLogs.map((log, i) => (
                    <tr key={i} className="border-t border-gray-700/30">
                      <td className="px-3 py-1.5">
                        <span className={log.direction === 'TX' ? 'text-blue-400' : 'text-green-400'}>{log.direction}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={log.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>{log.status}</span>
                      </td>
                      <td className="px-3 py-1.5 text-yellow-300 max-w-xs truncate">{log.rawData}</td>
                      <td className="px-3 py-1.5 text-gray-400 max-w-xs truncate">{JSON.stringify(log.parsed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
