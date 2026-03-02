import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import {
  Plus, Search, Trash2, Pencil, X, Wifi, WifiOff, Plug, PlugZap, Radio,
  Server, TestTube2, Check, AlertTriangle, Tag, ChevronDown,
} from 'lucide-react';

interface DeviceData {
  id: string;
  name: string;
  description?: string;
  protocol: string;
  enabled: boolean;
  host?: string | null;
  port?: number | null;
  slaveId?: number | null;
  serialPort?: string | null;
  baudRate?: number | null;
  dataBits?: number | null;
  stopBits?: number | null;
  parity?: string | null;
  endpointUrl?: string | null;
  securityMode?: string | null;
  securityPolicy?: string | null;
  username?: string | null;
  password?: string | null;
  pollIntervalMs: number;
  timeoutMs: number;
  retryCount: number;
  status: string;
  lastError?: string | null;
  lastConnectedAt?: string | null;
  projectId: string;
  _count?: { tags: number };
}

interface ProjectInfo {
  id: string;
  name: string;
}

const PROTOCOLS = ['MODBUS_RTU', 'MODBUS_TCP', 'OPC_UA', 'DNP3', 'IEC61850'] as const;

const PROTOCOL_LABELS: Record<string, string> = {
  MODBUS_RTU: 'Modbus RTU',
  MODBUS_TCP: 'Modbus TCP',
  OPC_UA: 'OPC UA',
  DNP3: 'DNP3',
  IEC61850: 'IEC 61850',
};

const PROTOCOL_ICONS: Record<string, React.ElementType> = {
  MODBUS_RTU: Radio,
  MODBUS_TCP: Server,
  OPC_UA: PlugZap,
  DNP3: Plug,
  IEC61850: Plug,
};

const PROTOCOL_COLORS: Record<string, string> = {
  MODBUS_RTU: 'bg-orange-100 text-orange-700 border-orange-200',
  MODBUS_TCP: 'bg-blue-100 text-blue-700 border-blue-200',
  OPC_UA: 'bg-purple-100 text-purple-700 border-purple-200',
  DNP3: 'bg-teal-100 text-teal-700 border-teal-200',
  IEC61850: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  CONNECTED: { icon: Wifi, color: 'bg-green-100 text-green-700', label: 'Connected' },
  DISCONNECTED: { icon: WifiOff, color: 'bg-gray-100 text-gray-500', label: 'Disconnected' },
  ERROR: { icon: AlertTriangle, color: 'bg-red-100 text-red-700', label: 'Error' },
};

const emptyDevice = {
  name: '', description: '', protocol: 'MODBUS_TCP' as string, enabled: true,
  host: '', port: 502, slaveId: 1,
  serialPort: '', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'NONE',
  endpointUrl: '', securityMode: 'None', securityPolicy: '', username: '', password: '',
  pollIntervalMs: 1000, timeoutMs: 5000, retryCount: 3,
};

export default function DeviceManager() {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceData | null>(null);
  const [form, setForm] = useState(emptyDevice);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get('/projects').then(({ data }) => setProjects(data)).catch(() => {});
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const params: any = {};
      if (filterProjectId) params.projectId = filterProjectId;
      const { data } = await api.get('/devices', { params });
      setDevices(data.filter((d: DeviceData) =>
        !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.description?.toLowerCase().includes(search.toLowerCase())
      ));
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }, [filterProjectId, search]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const openCreate = () => {
    setEditingDevice(null);
    setForm(emptyDevice);
    setShowModal(true);
  };

  const openEdit = (device: DeviceData) => {
    setEditingDevice(device);
    setForm({
      name: device.name,
      description: device.description || '',
      protocol: device.protocol,
      enabled: device.enabled,
      host: device.host || '',
      port: device.port ?? 502,
      slaveId: device.slaveId ?? 1,
      serialPort: device.serialPort || '',
      baudRate: device.baudRate ?? 9600,
      dataBits: device.dataBits ?? 8,
      stopBits: device.stopBits ?? 1,
      parity: device.parity || 'NONE',
      endpointUrl: device.endpointUrl || '',
      securityMode: device.securityMode || 'None',
      securityPolicy: device.securityPolicy || '',
      username: device.username || '',
      password: device.password || '',
      pollIntervalMs: device.pollIntervalMs,
      timeoutMs: device.timeoutMs,
      retryCount: device.retryCount,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        protocol: form.protocol,
        enabled: form.enabled,
        pollIntervalMs: form.pollIntervalMs,
        timeoutMs: form.timeoutMs,
        retryCount: form.retryCount,
      };

      // Protocol-specific fields
      if (form.protocol === 'MODBUS_TCP' || form.protocol === 'DNP3' || form.protocol === 'IEC61850') {
        payload.host = form.host || null;
        payload.port = form.port || null;
        payload.slaveId = form.protocol === 'MODBUS_TCP' ? (form.slaveId ?? null) : null;
      } else if (form.protocol === 'MODBUS_RTU') {
        payload.serialPort = form.serialPort || null;
        payload.baudRate = form.baudRate || null;
        payload.dataBits = form.dataBits || null;
        payload.stopBits = form.stopBits || null;
        payload.parity = form.parity || null;
        payload.slaveId = form.slaveId ?? null;
      } else if (form.protocol === 'OPC_UA') {
        payload.endpointUrl = form.endpointUrl || null;
        payload.securityMode = form.securityMode || null;
        payload.securityPolicy = form.securityPolicy || null;
        payload.username = form.username || null;
        payload.password = form.password || null;
      }

      if (editingDevice) {
        await api.put(`/devices/${editingDevice.id}`, payload);
      } else {
        if (!filterProjectId) {
          alert('Please select a project first');
          setSaving(false);
          return;
        }
        payload.projectId = filterProjectId;
        await api.post('/devices', payload);
      }
      setShowModal(false);
      loadDevices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save device');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device: DeviceData) => {
    if (!confirm(`Delete device "${device.name}"? Tags mapped to this device will be unmapped.`)) return;
    try {
      await api.delete(`/devices/${device.id}`);
      loadDevices();
    } catch (err) {
      console.error('Failed to delete device:', err);
    }
  };

  const handleTestConnection = async (device: DeviceData) => {
    setTestingId(device.id);
    setTestResult(null);
    try {
      const { data } = await api.post(`/devices/${device.id}/test-connection`);
      setTestResult({ id: device.id, success: data.success, message: data.message });
      loadDevices();
    } catch (err: any) {
      setTestResult({ id: device.id, success: false, message: err.response?.data?.error || 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const getConnectionSummary = (device: DeviceData): string => {
    switch (device.protocol) {
      case 'MODBUS_TCP': return `${device.host || '?'}:${device.port || '?'} (ID: ${device.slaveId ?? '?'})`;
      case 'MODBUS_RTU': return `${device.serialPort || '?'} @ ${device.baudRate || '?'} baud`;
      case 'OPC_UA': return device.endpointUrl || '(no endpoint)';
      case 'DNP3':
      case 'IEC61850': return `${device.host || '?'}:${device.port || '?'}`;
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">External Devices</h1>
            <p className="text-sm text-gray-500 mt-0.5">{devices.length} device{devices.length !== 1 ? 's' : ''} configured</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Device
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search devices..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Device Cards */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400">
            <Server className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No devices configured</p>
            <p className="text-sm mt-1">Add an external device to start collecting data</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {devices.map((device) => {
              const ProtoIcon = PROTOCOL_ICONS[device.protocol] || Plug;
              const statusCfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.DISCONNECTED;
              const StatusIcon = statusCfg.icon;
              return (
                <div key={device.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{device.name}</h3>
                        {!device.enabled && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">DISABLED</span>
                        )}
                      </div>
                      {device.description && (
                        <p className="text-xs text-gray-400 truncate">{device.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => openEdit(device)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(device)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Protocol + Status badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${PROTOCOL_COLORS[device.protocol] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      <ProtoIcon className="w-3 h-3" /> {PROTOCOL_LABELS[device.protocol] || device.protocol}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </div>

                  {/* Connection info */}
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-3 font-mono truncate">
                    {getConnectionSummary(device)}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {device._count?.tags ?? 0} tags
                    </span>
                    <span>Poll: {device.pollIntervalMs}ms</span>
                    <span>Timeout: {device.timeoutMs}ms</span>
                  </div>

                  {/* Error display */}
                  {device.lastError && device.status === 'ERROR' && (
                    <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 truncate" title={device.lastError}>
                      {device.lastError}
                    </div>
                  )}

                  {/* Test result */}
                  {testResult && testResult.id === device.id && (
                    <div className={`text-xs rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {testResult.success ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {testResult.message}
                    </div>
                  )}

                  {/* Test Connection button */}
                  <button
                    onClick={() => handleTestConnection(device)}
                    disabled={testingId === device.id}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
                  >
                    {testingId === device.id ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube2 className="w-3.5 h-3.5" /> Test Connection
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">{editingDevice ? 'Edit Device' : 'Add New Device'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Name + Protocol */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. PLC-01 Main Panel"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protocol *</label>
                  <select
                    value={form.protocol}
                    onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {PROTOCOLS.map((p) => <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Enabled toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </label>

              {/* ── Modbus TCP fields ── */}
              {form.protocol === 'MODBUS_TCP' && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-700">Modbus TCP Connection</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-blue-600 mb-1">Host *</label>
                      <input
                        type="text"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                        placeholder="192.168.1.100"
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-600 mb-1">Port *</label>
                      <input
                        type="number"
                        value={form.port}
                        onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-600 mb-1">Slave ID</label>
                      <input
                        type="number"
                        value={form.slaveId}
                        onChange={(e) => setForm({ ...form, slaveId: Number(e.target.value) })}
                        min={0} max={255}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Modbus RTU fields ── */}
              {form.protocol === 'MODBUS_RTU' && (
                <div className="bg-orange-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-orange-700">Modbus RTU Serial Connection</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Serial Port *</label>
                      <input
                        type="text"
                        value={form.serialPort}
                        onChange={(e) => setForm({ ...form, serialPort: e.target.value })}
                        placeholder="/dev/ttyUSB0 or COM1"
                        className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Slave ID</label>
                      <input
                        type="number"
                        value={form.slaveId}
                        onChange={(e) => setForm({ ...form, slaveId: Number(e.target.value) })}
                        min={0} max={255}
                        className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Baud Rate</label>
                      <select
                        value={form.baudRate}
                        onChange={(e) => setForm({ ...form, baudRate: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-orange-300 rounded-lg text-gray-900 bg-white"
                      >
                        {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) =>
                          <option key={b} value={b}>{b}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Parity</label>
                      <select
                        value={form.parity}
                        onChange={(e) => setForm({ ...form, parity: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-orange-300 rounded-lg text-gray-900 bg-white"
                      >
                        <option value="NONE">None</option>
                        <option value="EVEN">Even</option>
                        <option value="ODD">Odd</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Data Bits</label>
                      <select
                        value={form.dataBits}
                        onChange={(e) => setForm({ ...form, dataBits: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-orange-300 rounded-lg text-gray-900 bg-white"
                      >
                        {[5, 6, 7, 8].map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">Stop Bits</label>
                      <select
                        value={form.stopBits}
                        onChange={(e) => setForm({ ...form, stopBits: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-orange-300 rounded-lg text-gray-900 bg-white"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── OPC UA fields ── */}
              {form.protocol === 'OPC_UA' && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-purple-700">OPC UA Connection</h3>
                  <div>
                    <label className="block text-xs font-medium text-purple-600 mb-1">Endpoint URL *</label>
                    <input
                      type="text"
                      value={form.endpointUrl}
                      onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
                      placeholder="opc.tcp://192.168.1.100:4840"
                      className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-900 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Security Mode</label>
                      <select
                        value={form.securityMode}
                        onChange={(e) => setForm({ ...form, securityMode: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg text-gray-900 bg-white"
                      >
                        <option value="None">None</option>
                        <option value="Sign">Sign</option>
                        <option value="SignAndEncrypt">Sign & Encrypt</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Security Policy</label>
                      <select
                        value={form.securityPolicy}
                        onChange={(e) => setForm({ ...form, securityPolicy: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg text-gray-900 bg-white"
                      >
                        <option value="">None</option>
                        <option value="Basic128Rsa15">Basic128Rsa15</option>
                        <option value="Basic256">Basic256</option>
                        <option value="Basic256Sha256">Basic256Sha256</option>
                        <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                        <option value="Aes256_Sha256_RsaPss">Aes256_Sha256_RsaPss</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Username</label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── DNP3 / IEC61850 fields ── */}
              {(form.protocol === 'DNP3' || form.protocol === 'IEC61850') && (
                <div className="bg-teal-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-teal-700">{PROTOCOL_LABELS[form.protocol]} Connection</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-teal-600 mb-1">Host *</label>
                      <input
                        type="text"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                        placeholder="192.168.1.100"
                        className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-600 mb-1">Port *</label>
                      <input
                        type="number"
                        value={form.port}
                        onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Polling settings */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Polling Settings</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Poll Interval (ms)</label>
                    <input
                      type="number"
                      value={form.pollIntervalMs}
                      onChange={(e) => setForm({ ...form, pollIntervalMs: Number(e.target.value) })}
                      min={100}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Timeout (ms)</label>
                    <input
                      type="number"
                      value={form.timeoutMs}
                      onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
                      min={100}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Retry Count</label>
                    <input
                      type="number"
                      value={form.retryCount}
                      onChange={(e) => setForm({ ...form, retryCount: Number(e.target.value) })}
                      min={0} max={10}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingDevice ? 'Update Device' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
