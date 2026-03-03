import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Network,
  Play,
  Square,
  RotateCcw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
  ScrollText,
} from 'lucide-react';

// ─────────────────── Types ───────────────────

type ProtocolType = 'modbus-tcp' | 'iec61850' | 'dnp3' | 'simulator';
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface ProtocolConnection {
  id: string;
  name: string;
  protocol: ProtocolType;
  host: string;
  port: number | string;
  status: ConnectionStatus;
  tagsCount: number;
  lastDataReceived: string | null;
  uptimeSeconds: number;
  logs: LogEntry[];
  // Protocol-specific config
  modbusConfig?: {
    slaveId: number;
    registerStart: number;
    registerCount: number;
    pollIntervalMs: number;
  };
  iec61850Config?: {
    iedName: string;
    apTitle: string;
    datasetRef: string;
    reportControlBlock: string;
  };
  dnp3Config?: {
    masterAddress: number;
    outstationAddress: number;
    classPollingIntervalMs: number;
    unsolicitedEnabled: boolean;
  };
  simulatorConfig?: {
    signalCount: number;
    updateRateMs: number;
    noisePercent: number;
  };
}

// ─────────────────── Protocol Metadata ───────────────────

const PROTOCOL_META: Record<ProtocolType, { label: string; color: string; bgColor: string }> = {
  'modbus-tcp': { label: 'Modbus TCP', color: 'text-blue-400', bgColor: 'bg-blue-900/40 border-blue-700/50' },
  'iec61850': { label: 'IEC 61850', color: 'text-green-400', bgColor: 'bg-green-900/40 border-green-700/50' },
  'dnp3': { label: 'DNP3', color: 'text-orange-400', bgColor: 'bg-orange-900/40 border-orange-700/50' },
  'simulator': { label: 'Simulator', color: 'text-purple-400', bgColor: 'bg-purple-900/40 border-purple-700/50' },
};

const STATUS_META: Record<ConnectionStatus, { label: string; dotClass: string; textClass: string }> = {
  connected: { label: 'Connected', dotClass: 'bg-green-500', textClass: 'text-green-400' },
  disconnected: { label: 'Disconnected', dotClass: 'bg-gray-500', textClass: 'text-gray-400' },
  error: { label: 'Error', dotClass: 'bg-red-500', textClass: 'text-red-400' },
  connecting: { label: 'Connecting', dotClass: 'bg-yellow-500 animate-pulse', textClass: 'text-yellow-400' },
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: 'text-gray-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  SUCCESS: 'text-green-400',
};

// ─────────────────── Mock Data ───────────────────

function generateMockLogs(connectionName: string, count: number): LogEntry[] {
  const templates: { level: LogLevel; messages: string[] }[] = [
    { level: 'INFO', messages: [
      'Polling cycle completed successfully',
      'Register read batch completed (32 registers)',
      'Heartbeat sent to device',
      'Connection health check passed',
      'Data quality: all points valid',
    ]},
    { level: 'SUCCESS', messages: [
      `Connection to ${connectionName} established`,
      'Initial data synchronization completed',
      'Tag mapping validated - all tags resolved',
      'Device responded to identification request',
    ]},
    { level: 'WARN', messages: [
      'Response time exceeded 500ms threshold (623ms)',
      'Retry attempt 1/3 for register block 40001-40032',
      'Data quality flag: suspect value on tag VL1_N',
      'Communication timeout - attempting reconnect',
    ]},
    { level: 'ERROR', messages: [
      'CRC check failed on response frame',
      'Connection refused by remote host',
      'Exception code 0x02: Illegal data address',
      'Socket timeout after 5000ms',
    ]},
  ];

  const logs: LogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const age = (count - i) * 12000 + Math.random() * 5000;
    const template = templates[Math.floor(Math.random() * templates.length)];
    // Bias toward INFO/SUCCESS for a healthy-looking log
    const weightedTemplate = Math.random() > 0.3
      ? templates[Math.random() > 0.5 ? 0 : 1]
      : template;

    logs.push({
      id: `log-${connectionName}-${i}`,
      timestamp: new Date(now - age).toISOString(),
      level: weightedTemplate.level,
      message: weightedTemplate.messages[Math.floor(Math.random() * weightedTemplate.messages.length)],
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const INITIAL_CONNECTIONS: ProtocolConnection[] = [
  {
    id: 'conn-1',
    name: 'RTU-01 Waluj',
    protocol: 'modbus-tcp',
    host: '192.168.1.10',
    port: 502,
    status: 'connected',
    tagsCount: 47,
    lastDataReceived: new Date(Date.now() - 2000).toISOString(),
    uptimeSeconds: 86400 + 7200 + 1543,
    logs: generateMockLogs('RTU-01 Waluj', 35),
    modbusConfig: {
      slaveId: 1,
      registerStart: 40001,
      registerCount: 64,
      pollIntervalMs: 1000,
    },
  },
  {
    id: 'conn-2',
    name: 'IED-Bay1',
    protocol: 'iec61850',
    host: '192.168.1.20',
    port: 102,
    status: 'connected',
    tagsCount: 23,
    lastDataReceived: new Date(Date.now() - 1500).toISOString(),
    uptimeSeconds: 172800 + 3600 + 821,
    logs: generateMockLogs('IED-Bay1', 28),
    iec61850Config: {
      iedName: 'BAY1_IED',
      apTitle: '1.1.1.999.1',
      datasetRef: 'BAY1_IED/LLN0$dataset01',
      reportControlBlock: 'BAY1_IED/LLN0$BR$brcb01',
    },
  },
  {
    id: 'conn-3',
    name: 'DNP3-Master',
    protocol: 'dnp3',
    host: '192.168.1.30',
    port: 20000,
    status: 'disconnected',
    tagsCount: 0,
    lastDataReceived: null,
    uptimeSeconds: 0,
    logs: [
      {
        id: 'log-dnp3-err-1',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'ERROR',
        message: 'Connection refused by remote host 192.168.1.30:20000',
      },
      {
        id: 'log-dnp3-warn-1',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        level: 'WARN',
        message: 'Retry attempt 3/3 failed - marking connection as disconnected',
      },
      {
        id: 'log-dnp3-warn-2',
        timestamp: new Date(Date.now() - 135000).toISOString(),
        level: 'WARN',
        message: 'Retry attempt 2/3 - TCP handshake timeout',
      },
      {
        id: 'log-dnp3-warn-3',
        timestamp: new Date(Date.now() - 150000).toISOString(),
        level: 'WARN',
        message: 'Retry attempt 1/3 - no response from outstation',
      },
      {
        id: 'log-dnp3-info-1',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        level: 'INFO',
        message: 'Initiating TCP connection to 192.168.1.30:20000',
      },
    ],
    dnp3Config: {
      masterAddress: 1,
      outstationAddress: 10,
      classPollingIntervalMs: 5000,
      unsolicitedEnabled: true,
    },
  },
  {
    id: 'conn-4',
    name: 'Simulator',
    protocol: 'simulator',
    host: 'localhost',
    port: '-',
    status: 'connected',
    tagsCount: 52,
    lastDataReceived: new Date(Date.now() - 500).toISOString(),
    uptimeSeconds: 3600 * 4 + 2345,
    logs: generateMockLogs('Simulator', 42),
    simulatorConfig: {
      signalCount: 52,
      updateRateMs: 500,
      noisePercent: 5,
    },
  },
];

// ─────────────────── Helpers ───────────────────

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ─────────────────── Component: ConnectionManager ───────────────────

export default function ConnectionManager() {
  const [connections, setConnections] = useState<ProtocolConnection[]>(INITIAL_CONNECTIONS);

  // Fetch real connection data from API on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchConnections() {
      try {
        const mod = await import("@/services/api");
        const { data } = await mod.api.get("/diagnostics/summary");
        if (!cancelled && data?.devices?.length) {
          const mapped = data.devices.map((d: any) => ({
            id: d.deviceId || d.id,
            name: d.deviceName || d.name,
            protocol: (d.protocol || "simulator").toLowerCase().replace("_", "-"),
            host: d.host || d.ipAddress || "unknown",
            port: d.port || 502,
            status: (d.status || "disconnected").toLowerCase(),
            tagsCount: d.tagCount || 0,
            lastDataReceived: d.lastPoll || null,
            uptimeSeconds: d.uptime || 0,
            logs: [],
          }));
          setConnections(mapped);
        }
      } catch { /* API unavailable, keep mock data */ }
    }
    fetchConnections();
    return () => { cancelled = true; };
  }, []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);

  // Simulate real-time updates: uptime tick, last data timestamp refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setConnections((prev) =>
        prev.map((conn) => {
          if (conn.status === 'connected') {
            return {
              ...conn,
              uptimeSeconds: conn.uptimeSeconds + 1,
              lastDataReceived: new Date().toISOString(),
            };
          }
          return conn;
        }),
      );
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodically add log entries for connected connections
  useEffect(() => {
    const interval = setInterval(() => {
      setConnections((prev) =>
        prev.map((conn) => {
          if (conn.status !== 'connected') return conn;
          const newLog: LogEntry = {
            id: `log-auto-${conn.id}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: Math.random() > 0.85 ? 'WARN' : Math.random() > 0.5 ? 'SUCCESS' : 'INFO',
            message:
              Math.random() > 0.7
                ? `Polling cycle completed - ${conn.tagsCount} tags updated`
                : Math.random() > 0.5
                  ? 'Heartbeat acknowledged by device'
                  : `Data quality check passed (${conn.tagsCount} points)`,
          };
          return {
            ...conn,
            logs: [newLog, ...conn.logs].slice(0, 50),
          };
        }),
      );
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Connection actions
  const handleStart = useCallback((id: string) => {
    setConnections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newLog: LogEntry = {
          id: `log-start-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Starting connection to ${c.host}:${c.port}...`,
        };
        return { ...c, status: 'connecting' as ConnectionStatus, logs: [newLog, ...c.logs].slice(0, 50) };
      }),
    );
    // Simulate connecting -> connected after 2s
    setTimeout(() => {
      setConnections((prev) =>
        prev.map((c) => {
          if (c.id !== id || c.status !== 'connecting') return c;
          const successLog: LogEntry = {
            id: `log-connected-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'SUCCESS',
            message: `Connection established to ${c.host}:${c.port}`,
          };
          return {
            ...c,
            status: 'connected',
            lastDataReceived: new Date().toISOString(),
            uptimeSeconds: 0,
            logs: [successLog, ...c.logs].slice(0, 50),
          };
        }),
      );
    }, 2000);
  }, []);

  const handleStop = useCallback((id: string) => {
    setConnections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newLog: LogEntry = {
          id: `log-stop-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'WARN',
          message: 'Connection stopped by operator',
        };
        return {
          ...c,
          status: 'disconnected',
          uptimeSeconds: 0,
          logs: [newLog, ...c.logs].slice(0, 50),
        };
      }),
    );
  }, []);

  const handleRestart = useCallback((id: string) => {
    handleStop(id);
    setTimeout(() => handleStart(id), 500);
  }, [handleStart, handleStop]);

  const handleAddConnection = useCallback((conn: ProtocolConnection) => {
    setConnections((prev) => [...prev, conn]);
    setShowAddModal(false);
  }, []);

  const toggleLogs = useCallback((id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Stats
  const stats = {
    total: connections.length,
    connected: connections.filter((c) => c.status === 'connected').length,
    disconnected: connections.filter((c) => c.status === 'disconnected').length,
    error: connections.filter((c) => c.status === 'error').length,
  };

  return (
    <div className="space-y-4 overflow-auto">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Protocol Connections</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Stats pills */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300">
              Total: <span className="font-bold text-white">{stats.total}</span>
            </span>
            <span className="px-2 py-1 rounded bg-green-900/30 border border-green-800/50 text-green-400">
              Connected: <span className="font-bold">{stats.connected}</span>
            </span>
            <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400">
              Disconnected: <span className="font-bold">{stats.disconnected}</span>
            </span>
            {stats.error > 0 && (
              <span className="px-2 py-1 rounded bg-red-900/30 border border-red-800/50 text-red-400">
                Error: <span className="font-bold">{stats.error}</span>
              </span>
            )}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Connection
          </button>
        </div>
      </div>

      {/* ─── Connection Cards Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {connections.map((conn) => (
          <ConnectionCard
            key={conn.id}
            connection={conn}
            isLogExpanded={!!expandedLogs[conn.id]}
            onStart={() => handleStart(conn.id)}
            onStop={() => handleStop(conn.id)}
            onRestart={() => handleRestart(conn.id)}
            onToggleLogs={() => toggleLogs(conn.id)}
          />
        ))}
      </div>

      {connections.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <WifiOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">No connections configured</p>
          <p className="text-sm mt-1">Click "Add Connection" to get started</p>
        </div>
      )}

      {/* ─── Add Connection Modal ─── */}
      {showAddModal && (
        <AddConnectionModal
          onSave={handleAddConnection}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ─────────────────── Connection Card ───────────────────

interface ConnectionCardProps {
  connection: ProtocolConnection;
  isLogExpanded: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onToggleLogs: () => void;
}

function ConnectionCard({
  connection: conn,
  isLogExpanded,
  onStart,
  onStop,
  onRestart,
  onToggleLogs,
}: ConnectionCardProps) {
  const proto = PROTOCOL_META[conn.protocol];
  const status = STATUS_META[conn.status];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Protocol badge + name + address */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {/* Protocol badge */}
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${proto.bgColor} ${proto.color}`}>
                {proto.label}
              </span>
              {/* Status indicator */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                <span className={`text-xs font-medium ${status.textClass}`}>{status.label}</span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-white truncate">{conn.name}</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {conn.host}{conn.port !== '-' ? `:${conn.port}` : ''}
            </p>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {conn.status === 'disconnected' || conn.status === 'error' ? (
              <button
                onClick={onStart}
                className="p-1.5 rounded bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors"
                title="Start connection"
              >
                <Play className="w-4 h-4" />
              </button>
            ) : conn.status === 'connecting' ? (
              <button
                disabled
                className="p-1.5 rounded bg-yellow-900/20 text-yellow-400 cursor-not-allowed"
                title="Connecting..."
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </button>
            ) : (
              <button
                onClick={onStop}
                className="p-1.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                title="Stop connection"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onRestart}
              disabled={conn.status === 'connecting'}
              className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Restart connection"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <Tag className="w-3 h-3" />
            <span><span className="text-white font-medium">{conn.tagsCount}</span> tags</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Uptime: <span className="text-white font-mono font-medium">{formatUptime(conn.uptimeSeconds)}</span></span>
          </div>
          {conn.lastDataReceived && (
            <div className="flex items-center gap-1 text-gray-400">
              <Wifi className="w-3 h-3" />
              <span>Last data: <span className="text-white font-mono">{formatRelativeTime(conn.lastDataReceived)}</span></span>
            </div>
          )}
          {!conn.lastDataReceived && conn.status === 'disconnected' && (
            <div className="flex items-center gap-1 text-gray-500">
              <WifiOff className="w-3 h-3" />
              <span>No data received</span>
            </div>
          )}
        </div>
      </div>

      {/* Log Viewer Toggle */}
      <button
        onClick={onToggleLogs}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-900/80 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <ScrollText className="w-3 h-3" />
          <span>Connection Log ({conn.logs.length} entries)</span>
        </div>
        {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Log Viewer */}
      {isLogExpanded && (
        <div className="bg-gray-900 border-t border-gray-700 max-h-56 overflow-y-auto">
          {conn.logs.length === 0 ? (
            <p className="text-xs text-gray-500 p-3 text-center">No log entries</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {conn.logs.map((log) => (
                <div key={log.id} className="px-4 py-1.5 flex items-start gap-2 text-[11px] font-mono">
                  <span className="text-gray-500 shrink-0">{formatTimestamp(log.timestamp)}</span>
                  <span className={`shrink-0 w-[52px] text-right font-bold ${LOG_LEVEL_COLORS[log.level]}`}>
                    [{log.level}]
                  </span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────── Add Connection Modal ───────────────────

interface AddConnectionModalProps {
  onSave: (conn: ProtocolConnection) => void;
  onCancel: () => void;
}

function AddConnectionModal({ onSave, onCancel }: AddConnectionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ProtocolType>('modbus-tcp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');

  // Modbus TCP fields
  const [slaveId, setSlaveId] = useState('1');
  const [registerStart, setRegisterStart] = useState('40001');
  const [registerCount, setRegisterCount] = useState('64');
  const [pollInterval, setPollInterval] = useState('1000');

  // IEC 61850 fields
  const [iedName, setIedName] = useState('');
  const [apTitle, setApTitle] = useState('1.1.1.999.1');
  const [datasetRef, setDatasetRef] = useState('');
  const [reportControlBlock, setReportControlBlock] = useState('');

  // DNP3 fields
  const [masterAddress, setMasterAddress] = useState('1');
  const [outstationAddress, setOutstationAddress] = useState('10');
  const [classPollingInterval, setClassPollingInterval] = useState('5000');
  const [unsolicitedEnabled, setUnsolicitedEnabled] = useState(true);

  // Simulator fields
  const [signalCount, setSignalCount] = useState('32');
  const [updateRate, setUpdateRate] = useState('500');
  const [noisePercent, setNoisePercent] = useState('5');

  // Set sensible default ports when protocol changes
  useEffect(() => {
    switch (protocol) {
      case 'modbus-tcp':
        setPort('502');
        setHost((prev) => prev || '192.168.1.100');
        break;
      case 'iec61850':
        setPort('102');
        setHost((prev) => prev || '192.168.1.100');
        break;
      case 'dnp3':
        setPort('20000');
        setHost((prev) => prev || '192.168.1.100');
        break;
      case 'simulator':
        setPort('');
        setHost('localhost');
        break;
    }
  }, [protocol]);

  const isValid = name.trim().length > 0 && host.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;

    const conn: ProtocolConnection = {
      id: `conn-${Date.now()}`,
      name: name.trim(),
      protocol,
      host: host.trim(),
      port: protocol === 'simulator' ? '-' : parseInt(port, 10) || 502,
      status: 'disconnected',
      tagsCount: 0,
      lastDataReceived: null,
      uptimeSeconds: 0,
      logs: [
        {
          id: `log-created-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Connection "${name.trim()}" created - protocol: ${PROTOCOL_META[protocol].label}`,
        },
      ],
    };

    // Attach protocol-specific config
    switch (protocol) {
      case 'modbus-tcp':
        conn.modbusConfig = {
          slaveId: parseInt(slaveId, 10) || 1,
          registerStart: parseInt(registerStart, 10) || 40001,
          registerCount: parseInt(registerCount, 10) || 64,
          pollIntervalMs: parseInt(pollInterval, 10) || 1000,
        };
        break;
      case 'iec61850':
        conn.iec61850Config = {
          iedName: iedName.trim() || 'IED_001',
          apTitle: apTitle.trim(),
          datasetRef: datasetRef.trim(),
          reportControlBlock: reportControlBlock.trim(),
        };
        break;
      case 'dnp3':
        conn.dnp3Config = {
          masterAddress: parseInt(masterAddress, 10) || 1,
          outstationAddress: parseInt(outstationAddress, 10) || 10,
          classPollingIntervalMs: parseInt(classPollingInterval, 10) || 5000,
          unsolicitedEnabled,
        };
        break;
      case 'simulator':
        conn.simulatorConfig = {
          signalCount: parseInt(signalCount, 10) || 32,
          updateRateMs: parseInt(updateRate, 10) || 500,
          noisePercent: parseInt(noisePercent, 10) || 5,
        };
        conn.tagsCount = parseInt(signalCount, 10) || 32;
        break;
    }

    onSave(conn);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onCancel();
    }
  };

  const inputClass =
    'w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none';
  const labelClass = 'block text-xs text-gray-400 mb-1';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Add Connection</h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Connection Name */}
          <div>
            <label className={labelClass}>Connection Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., RTU-02 Cidco"
              className={inputClass}
            />
          </div>

          {/* Protocol Type */}
          <div>
            <label className={labelClass}>Protocol Type</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as ProtocolType)}
              className={inputClass}
            >
              <option value="modbus-tcp">Modbus TCP</option>
              <option value="iec61850">IEC 61850 (MMS)</option>
              <option value="dnp3">DNP3</option>
              <option value="simulator">Simulator</option>
            </select>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Host / IP Address *</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100"
                className={inputClass}
                disabled={protocol === 'simulator'}
              />
            </div>
            <div>
              <label className={labelClass}>Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="502"
                className={inputClass}
                disabled={protocol === 'simulator'}
              />
            </div>
          </div>

          {/* Protocol-Specific Fields */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
              {PROTOCOL_META[protocol].label} Configuration
            </p>

            {protocol === 'modbus-tcp' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Slave ID</label>
                  <input
                    type="number"
                    value={slaveId}
                    onChange={(e) => setSlaveId(e.target.value)}
                    className={inputClass}
                    min="1"
                    max="247"
                  />
                </div>
                <div>
                  <label className={labelClass}>Register Start</label>
                  <input
                    type="number"
                    value={registerStart}
                    onChange={(e) => setRegisterStart(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Register Count</label>
                  <input
                    type="number"
                    value={registerCount}
                    onChange={(e) => setRegisterCount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Poll Interval (ms)</label>
                  <input
                    type="number"
                    value={pollInterval}
                    onChange={(e) => setPollInterval(e.target.value)}
                    className={inputClass}
                    min="100"
                    step="100"
                  />
                </div>
              </div>
            )}

            {protocol === 'iec61850' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>IED Name</label>
                    <input
                      type="text"
                      value={iedName}
                      onChange={(e) => setIedName(e.target.value)}
                      placeholder="BAY1_IED"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>AP Title</label>
                    <input
                      type="text"
                      value={apTitle}
                      onChange={(e) => setApTitle(e.target.value)}
                      placeholder="1.1.1.999.1"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Dataset Reference</label>
                  <input
                    type="text"
                    value={datasetRef}
                    onChange={(e) => setDatasetRef(e.target.value)}
                    placeholder="IED_NAME/LLN0$dataset01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Report Control Block</label>
                  <input
                    type="text"
                    value={reportControlBlock}
                    onChange={(e) => setReportControlBlock(e.target.value)}
                    placeholder="IED_NAME/LLN0$BR$brcb01"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {protocol === 'dnp3' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Master Address</label>
                  <input
                    type="number"
                    value={masterAddress}
                    onChange={(e) => setMasterAddress(e.target.value)}
                    className={inputClass}
                    min="0"
                    max="65519"
                  />
                </div>
                <div>
                  <label className={labelClass}>Outstation Address</label>
                  <input
                    type="number"
                    value={outstationAddress}
                    onChange={(e) => setOutstationAddress(e.target.value)}
                    className={inputClass}
                    min="0"
                    max="65519"
                  />
                </div>
                <div>
                  <label className={labelClass}>Class Poll Interval (ms)</label>
                  <input
                    type="number"
                    value={classPollingInterval}
                    onChange={(e) => setClassPollingInterval(e.target.value)}
                    className={inputClass}
                    min="1000"
                    step="1000"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unsolicitedEnabled}
                      onChange={(e) => setUnsolicitedEnabled(e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-900 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-xs text-gray-300">Enable Unsolicited Responses</span>
                  </label>
                </div>
              </div>
            )}

            {protocol === 'simulator' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Signal Count</label>
                  <input
                    type="number"
                    value={signalCount}
                    onChange={(e) => setSignalCount(e.target.value)}
                    className={inputClass}
                    min="1"
                    max="500"
                  />
                </div>
                <div>
                  <label className={labelClass}>Update Rate (ms)</label>
                  <input
                    type="number"
                    value={updateRate}
                    onChange={(e) => setUpdateRate(e.target.value)}
                    className={inputClass}
                    min="100"
                    step="100"
                  />
                </div>
                <div>
                  <label className={labelClass}>Noise %</label>
                  <input
                    type="number"
                    value={noisePercent}
                    onChange={(e) => setNoisePercent(e.target.value)}
                    className={inputClass}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm bg-gray-700 border border-gray-600 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save Connection
          </button>
        </div>
      </div>
    </div>
  );
}
