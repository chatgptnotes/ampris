import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Shield, Server, ArrowRightLeft, Heart, AlertTriangle, Check, Play, ChevronDown } from 'lucide-react';

interface RedundancyConfigData {
  id: string;
  role: string;
  partnerHost: string | null;
  partnerPort: number | null;
  heartbeatMs: number;
  failoverTimeout: number;
  autoFailover: boolean;
  syncInterval: number;
  status: string;
  lastHeartbeat: string | null;
  lastSync: string | null;
  projectId: string;
}

interface FailoverEventData {
  id: string;
  type: string;
  fromRole: string;
  toRole: string;
  reason: string | null;
  createdAt: string;
}

interface StatusData {
  role: string;
  status: string;
  uptime: number;
  partner: { connected: boolean; lastHeartbeat: string | null; latencyMs: number };
  lastSync: string | null;
  config: RedundancyConfigData | null;
}

const TYPE_COLORS: Record<string, string> = {
  HEARTBEAT_LOST: 'bg-red-900/50 text-red-400',
  FAILOVER_STARTED: 'bg-yellow-900/50 text-yellow-400',
  FAILOVER_COMPLETE: 'bg-orange-900/50 text-orange-400',
  SWITCHBACK: 'bg-green-900/50 text-green-400',
  SYNC_ERROR: 'bg-purple-900/50 text-purple-400',
};

export default function RedundancyManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [events, setEvents] = useState<FailoverEventData[]>([]);
  const [config, setConfig] = useState<Partial<RedundancyConfigData>>({
    role: 'PRIMARY',
    partnerHost: '',
    partnerPort: 8080,
    heartbeatMs: 5000,
    failoverTimeout: 15000,
    autoFailover: true,
    syncInterval: 10000,
  });
  const [showConfig, setShowConfig] = useState(false);
  const [heartbeatAnim, setHeartbeatAnim] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [statusRes, eventsRes] = await Promise.all([
        api.get('/redundancy/status', { params: { projectId } }),
        api.get('/redundancy/events', { params: { projectId } }),
      ]);
      setStatus(statusRes.data);
      setEvents(eventsRes.data);
      if (statusRes.data.config) {
        setConfig(statusRes.data.config);
      }
      // Heartbeat animation
      if (statusRes.data.partner?.connected) {
        setHeartbeatAnim(true);
        setTimeout(() => setHeartbeatAnim(false), 300);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const saveConfig = async () => {
    try {
      await api.post('/redundancy/config', { ...config, projectId });
      setShowConfig(false);
      fetchData();
    } catch {}
  };

  const promote = async () => {
    try { await api.post('/redundancy/promote', { projectId }); fetchData(); } catch {}
  };
  const demote = async () => {
    try { await api.post('/redundancy/demote', { projectId }); fetchData(); } catch {}
  };
  const testFailover = async () => {
    try { await api.post('/redundancy/test-failover', { projectId }); fetchData(); } catch {}
  };

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const thisStatus = status?.status || 'standalone';
  const partnerConnected = status?.partner?.connected || false;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Redundancy & Failover</h1>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
          Configure
        </button>
      </div>

      {/* Server Diagram */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="flex items-center justify-center gap-12">
          {/* Primary Server */}
          <div className={`flex flex-col items-center p-6 rounded-xl border-2 ${thisStatus === 'active' ? 'border-green-500 bg-green-900/10' : thisStatus === 'standby' ? 'border-yellow-500 bg-yellow-900/10' : 'border-gray-600 bg-gray-900/30'}`}>
            <Server className={`w-12 h-12 ${thisStatus === 'active' ? 'text-green-400' : thisStatus === 'standby' ? 'text-yellow-400' : 'text-gray-500'}`} />
            <span className="text-white font-medium mt-2">This Server</span>
            <span className={`text-xs mt-1 px-2 py-0.5 rounded ${thisStatus === 'active' ? 'bg-green-600 text-white' : thisStatus === 'standby' ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
              {status?.role || 'STANDALONE'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Uptime: {formatUptime(status?.uptime || 0)}</span>
          </div>

          {/* Connection Line */}
          <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-2 transition-all ${heartbeatAnim ? 'scale-110' : ''}`}>
              <div className={`h-0.5 w-16 ${partnerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <Heart className={`w-5 h-5 ${partnerConnected ? 'text-green-400' : 'text-red-400'} ${heartbeatAnim ? 'animate-ping' : ''}`} />
              <div className={`h-0.5 w-16 ${partnerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            {status?.partner?.latencyMs != null && (
              <span className="text-xs text-gray-500">{status.partner.latencyMs}ms</span>
            )}
          </div>

          {/* Partner Server */}
          <div className={`flex flex-col items-center p-6 rounded-xl border-2 ${partnerConnected ? 'border-blue-500 bg-blue-900/10' : 'border-gray-600 bg-gray-900/30'}`}>
            <Server className={`w-12 h-12 ${partnerConnected ? 'text-blue-400' : 'text-gray-600'}`} />
            <span className="text-white font-medium mt-2">Partner</span>
            <span className={`text-xs mt-1 px-2 py-0.5 rounded ${partnerConnected ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-500'}`}>
              {partnerConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
            <span className="text-xs text-gray-400 mt-1">
              {config.partnerHost ? `${config.partnerHost}:${config.partnerPort}` : 'Not configured'}
            </span>
          </div>
        </div>

        {/* ECG-like heartbeat line */}
        <div className="mt-6 overflow-hidden h-12">
          <svg viewBox="0 0 400 40" className="w-full h-full">
            <polyline
              points={partnerConnected ?
                "0,20 50,20 60,20 70,5 80,35 90,20 100,20 150,20 160,20 170,5 180,35 190,20 200,20 250,20 260,20 270,5 280,35 290,20 300,20 350,20 360,20 370,5 380,35 390,20 400,20" :
                "0,20 400,20"
              }
              fill="none"
              stroke={partnerConnected ? '#22c55e' : '#ef4444'}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={promote} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" /> Promote to Primary
        </button>
        <button onClick={demote} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm flex items-center gap-2">
          <ChevronDown className="w-4 h-4" /> Demote to Standby
        </button>
        <button onClick={testFailover} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Test Failover
        </button>
      </div>

      {/* Status Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-gray-400 text-xs mb-2">This Server</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Role:</span><span className="text-white">{status?.role || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Status:</span><span className="text-white capitalize">{thisStatus}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Uptime:</span><span className="text-white">{formatUptime(status?.uptime || 0)}</span></div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-gray-400 text-xs mb-2">Partner</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Status:</span><span className={partnerConnected ? 'text-green-400' : 'text-red-400'}>{partnerConnected ? 'Connected' : 'Disconnected'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Last HB:</span><span className="text-white">{status?.partner?.lastHeartbeat ? new Date(status.partner.lastHeartbeat).toLocaleTimeString() : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Latency:</span><span className="text-white">{status?.partner?.latencyMs ?? '-'}ms</span></div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-gray-400 text-xs mb-2">Sync</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Last Sync:</span><span className="text-white">{status?.config?.lastSync ? new Date(status.config.lastSync).toLocaleTimeString() : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Interval:</span><span className="text-white">{config.syncInterval}ms</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Auto-Failover:</span><span className={config.autoFailover ? 'text-green-400' : 'text-red-400'}>{config.autoFailover ? 'ON' : 'OFF'}</span></div>
          </div>
        </div>
      </div>

      {/* Config Form */}
      {showConfig && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
          <h3 className="text-white font-medium">Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select value={config.role || 'PRIMARY'} onChange={(e) => setConfig({ ...config, role: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded text-sm">
                <option value="PRIMARY">PRIMARY</option>
                <option value="STANDBY">STANDBY</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Partner Host</label>
              <input type="text" value={config.partnerHost || ''} onChange={(e) => setConfig({ ...config, partnerHost: e.target.value })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Partner Port</label>
              <input type="number" value={config.partnerPort || 8080} onChange={(e) => setConfig({ ...config, partnerPort: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Heartbeat (ms)</label>
              <input type="number" value={config.heartbeatMs || 5000} onChange={(e) => setConfig({ ...config, heartbeatMs: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Failover Timeout (ms)</label>
              <input type="number" value={config.failoverTimeout || 15000} onChange={(e) => setConfig({ ...config, failoverTimeout: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={config.autoFailover ?? true} onChange={(e) => setConfig({ ...config, autoFailover: e.target.checked })} className="rounded" />
              <label className="text-sm text-white">Auto-Failover</label>
            </div>
          </div>
          <button onClick={saveConfig} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      )}

      {/* Event Log */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Failover Events</h3>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">No events</div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {events.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[e.type] || 'bg-gray-700 text-gray-400'}`}>
                    {e.type}
                  </span>
                  <span className="text-sm text-gray-400">{e.fromRole} → {e.toRole}</span>
                  {e.reason && <span className="text-xs text-gray-500 truncate flex-1">{e.reason}</span>}
                  <span className="text-xs text-gray-600 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
