import { useState, useCallback } from 'react';
import {
  Search, Wifi, WifiOff, Radio, Zap, Download, RefreshCw,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2,
  Database, Activity, Shield, FileDown, Network,
} from 'lucide-react';
import axios from 'axios';
import IEC61850Browser from '@/components/IEC61850Browser';

const API = '/api/relay-explorer';

// ─── Types ──────────────────────────────────────────

interface DiscoveredDevice {
  ip: string;
  mac?: string;
  model?: string;
  portsOpen: number[];
  source: string;
  hostname?: string;
}

interface ConnectionStatus {
  modbus: { port: number; connected: boolean };
  mms: { port: number; connected: boolean };
}

interface RegisterDecoding {
  register: number;
  rawHex: string;
  decodings: Array<{ type: string; value: number | boolean | string; hex: string }>;
}

interface DiscoveredPoint {
  register: number;
  rawHex: string;
  value: number | boolean;
  dataType: string;
  matchedTemplate?: string;
  name?: string;
  description?: string;
  unit?: string;
}

interface ScanResult {
  identifiedModel: string | null;
  identifiedDescription: string | null;
  discoveredPoints: DiscoveredPoint[];
  totalPoints: number;
}

interface RelayTemplate {
  model: string;
  manufacturer: string;
  series: string;
  description: string;
  registerCount: number;
  categories: { measurement: number; protection: number; status: number; energy: number };
}

// ─── Component ──────────────────────────────────────

export default function RelayExplorer() {
  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);

  // Connection state
  const [targetIP, setTargetIP] = useState('');
  const [modbusPort, setModbusPort] = useState(502);
  const [mmsPort, setMmsPort] = useState(102);
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);

  // Modbus read state
  const [startRegister, setStartRegister] = useState(2000);
  const [registerCount, setRegisterCount] = useState(10);
  const [slaveId, setSlaveId] = useState(1);
  const [functionCode, setFunctionCode] = useState(3);
  const [byteOrder, setByteOrder] = useState('BIG_ENDIAN');
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<{ rawHex: string; decoded: RegisterDecoding[] } | null>(null);

  // Auto-scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Templates
  const [templates, setTemplates] = useState<RelayTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Errors
  const [error, setError] = useState<string | null>(null);

  // Selected points for export
  const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());

  // ─── Discovery ────────────────────────────────────

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/discover`, { timeout: 1000 });
      setDiscoveredDevices(data.devices);
      if (data.devices.length === 0) {
        setError('No devices found. Make sure you are on the same network/subnet as the relay.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setDiscovering(false);
    }
  }, []);

  // ─── Connection Test ──────────────────────────────

  const handleTestConnection = useCallback(async () => {
    if (!targetIP) return;
    setTesting(true);
    setError(null);
    setConnStatus(null);
    try {
      const { data } = await axios.post(`${API}/test-connection`, {
        host: targetIP,
        modbusPort,
        mmsPort,
      });
      setConnStatus(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  }, [targetIP, modbusPort, mmsPort]);

  // ─── Modbus Read ──────────────────────────────────

  const handleModbusRead = useCallback(async () => {
    if (!targetIP) return;
    setReading(true);
    setError(null);
    setReadResult(null);
    try {
      const { data } = await axios.post(`${API}/modbus-read`, {
        host: targetIP,
        port: modbusPort,
        slaveId,
        functionCode,
        startRegister,
        count: registerCount,
        byteOrder,
      });
      setReadResult({ rawHex: data.rawHex, decoded: data.decoded });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setReading(false);
    }
  }, [targetIP, modbusPort, slaveId, functionCode, startRegister, registerCount, byteOrder]);

  // ─── Auto Scan ────────────────────────────────────

  const handleAutoScan = useCallback(async () => {
    if (!targetIP) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    try {
      const { data } = await axios.post(`${API}/modbus-scan`, {
        host: targetIP,
        port: modbusPort,
        slaveId,
      });
      setScanResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setScanning(false);
    }
  }, [targetIP, modbusPort, slaveId]);

  // ─── Templates ────────────────────────────────────

  const handleLoadTemplates = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/templates`);
      setTemplates(data);
      setShowTemplates(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // ─── Export ───────────────────────────────────────

  const handleExportJSON = useCallback(async () => {
    if (!scanResult) return;
    const points = scanResult.discoveredPoints
      .filter((_pt: DiscoveredPoint, i: number) => selectedPoints.size === 0 || selectedPoints.has(i))
      .map((p: DiscoveredPoint) => ({
        name: p.name || `REG_${p.register}`,
        description: p.description,
        address: p.register,
        dataType: p.dataType,
        unit: p.unit,
        category: 'measurement',
      }));

    try {
      const { data } = await axios.post(`${API}/export-tags`, {
        points,
        format: 'json',
        prefix: '',
        deviceName: scanResult.identifiedModel || 'ABB_Relay',
      });

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relay_tags.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  }, [scanResult, selectedPoints]);

  const handleExportCSV = useCallback(async () => {
    if (!scanResult) return;
    const points = scanResult.discoveredPoints
      .filter((_pt: DiscoveredPoint, i: number) => selectedPoints.size === 0 || selectedPoints.has(i))
      .map((p: DiscoveredPoint) => ({
        name: p.name || `REG_${p.register}`,
        description: p.description,
        address: p.register,
        dataType: p.dataType,
        unit: p.unit,
        category: 'measurement',
      }));

    try {
      const { data } = await axios.post(`${API}/export-tags`, {
        points,
        format: 'csv',
        prefix: '',
        deviceName: scanResult.identifiedModel || 'ABB_Relay',
      }, { responseType: 'blob' });

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relay_tags.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  }, [scanResult, selectedPoints]);

  const togglePointSelection = (index: number) => {
    setSelectedPoints((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const selectAllPoints = () => {
    if (!scanResult) return;
    if (selectedPoints.size === scanResult.discoveredPoints.length) {
      setSelectedPoints(new Set());
    } else {
      setSelectedPoints(new Set(scanResult.discoveredPoints.map((_, i) => i)));
    }
  };

  // ─── Render ───────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Radio className="w-7 h-7 text-cyan-400" />
          Relay Explorer
        </h1>
        <p className="text-gray-400 mt-1">
          Connect directly to ABB protection relays to discover data models and read measurements
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400/60 text-xs mt-1 hover:text-red-400">Dismiss</button>
          </div>
        </div>
      )}

      {/* Discovery Panel */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-cyan-400" />
          Relay Discovery
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Scan the local network for ABB relays. Checks ARP table, common ABB default IPs, and scans common subnets on ports 502 (Modbus) and 102 (MMS).
        </p>
        <button
          onClick={handleDiscover}
          disabled={discovering}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          {discovering ? 'Scanning...' : 'Discover Relays'}
        </button>

        {discoveredDevices.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-3">IP Address</th>
                  <th className="text-left py-2 px-3">MAC</th>
                  <th className="text-left py-2 px-3">Ports Open</th>
                  <th className="text-left py-2 px-3">Source</th>
                  <th className="text-left py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {discoveredDevices.map((dev, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 px-3 text-white font-mono">{dev.ip}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs">{dev.mac || '—'}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {dev.portsOpen.map(p => (
                          <span key={p} className={`px-2 py-0.5 rounded text-xs font-medium ${
                            p === 502 ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {p === 502 ? 'Modbus' : p === 102 ? 'MMS' : p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-gray-400 text-xs capitalize">{dev.source}</span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => { setTargetIP(dev.ip); setConnStatus(null); setReadResult(null); setScanResult(null); }}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                      >
                        Connect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Connection Panel */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          Connection
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Relay IP Address</label>
            <input
              type="text"
              value={targetIP}
              onChange={(e) => setTargetIP(e.target.value)}
              placeholder="e.g. 10.0.0.1"
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Modbus Port</label>
            <input
              type="number"
              value={modbusPort}
              onChange={(e) => setModbusPort(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">MMS Port</label>
            <input
              type="number"
              value={mmsPort}
              onChange={(e) => setMmsPort(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleTestConnection}
              disabled={testing || !targetIP}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 w-full justify-center"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              Test Connection
            </button>
          </div>
        </div>

        {connStatus && (
          <div className="flex gap-4 mt-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              connStatus.modbus.connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {connStatus.modbus.connected ? <CheckCircle2 className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              Modbus TCP (:{connStatus.modbus.port}) — {connStatus.modbus.connected ? 'Connected' : 'Not Reachable'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              connStatus.mms.connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {connStatus.mms.connected ? <CheckCircle2 className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              IEC 61850 MMS (:{connStatus.mms.port}) — {connStatus.mms.connected ? 'Connected' : 'Not Reachable'}
            </div>
          </div>
        )}
      </section>

      {/* Modbus Register Reader */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-green-400" />
          Modbus Register Reader
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Start Register</label>
            <input
              type="number"
              value={startRegister}
              onChange={(e) => setStartRegister(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Count</label>
            <input
              type="number"
              value={registerCount}
              onChange={(e) => setRegisterCount(Number(e.target.value))}
              min={1}
              max={125}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Slave ID</label>
            <input
              type="number"
              value={slaveId}
              onChange={(e) => setSlaveId(Number(e.target.value))}
              min={0}
              max={255}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Function Code</label>
            <select
              value={functionCode}
              onChange={(e) => setFunctionCode(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value={3}>FC03 (Holding)</option>
              <option value={4}>FC04 (Input)</option>
              <option value={1}>FC01 (Coils)</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Byte Order</label>
            <select
              value={byteOrder}
              onChange={(e) => setByteOrder(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="BIG_ENDIAN">Big Endian (AB CD)</option>
              <option value="LITTLE_ENDIAN">Little Endian (CD AB)</option>
              <option value="MID_BIG">Mid Big (BA DC)</option>
              <option value="MID_LITTLE">Mid Little (DC BA)</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleModbusRead}
              disabled={reading || !targetIP}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Read
            </button>
          </div>
        </div>

        {readResult && (
          <div className="mt-4">
            <div className="bg-gray-900 rounded-lg p-3 mb-3 font-mono text-xs text-gray-300 overflow-x-auto">
              <span className="text-gray-500">Raw Hex:</span> {readResult.rawHex}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-3">Register</th>
                    <th className="text-left py-2 px-3">Raw Hex</th>
                    <th className="text-left py-2 px-3">UINT16</th>
                    <th className="text-left py-2 px-3">INT16</th>
                    <th className="text-left py-2 px-3">FLOAT32</th>
                    <th className="text-left py-2 px-3">UINT32</th>
                  </tr>
                </thead>
                <tbody>
                  {readResult.decoded.map((entry, i) => {
                    const uint16 = entry.decodings.find(d => d.type === 'UINT16');
                    const int16 = entry.decodings.find(d => d.type === 'INT16');
                    const float32 = entry.decodings.find(d => d.type === 'FLOAT32');
                    const uint32 = entry.decodings.find(d => d.type === 'UINT32');
                    return (
                      <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-1.5 px-3 text-cyan-400 font-mono">{entry.register}</td>
                        <td className="py-1.5 px-3 text-gray-300 font-mono">{entry.rawHex}</td>
                        <td className="py-1.5 px-3 text-white font-mono">{uint16?.value ?? '—'}</td>
                        <td className="py-1.5 px-3 text-white font-mono">{int16?.value ?? '—'}</td>
                        <td className="py-1.5 px-3 text-yellow-300 font-mono">{float32?.value ?? '—'}</td>
                        <td className="py-1.5 px-3 text-white font-mono">{uint32?.value ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Auto-Scan ABB Registers */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-purple-400" />
          Auto-Scan ABB Registers
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Reads known ABB measurement register ranges and identifies which ones return valid data.
          Tries to match the relay model based on available registers.
        </p>
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleAutoScan}
            disabled={scanning || !targetIP}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'Scanning Registers...' : 'Scan Common ABB Registers'}
          </button>
          <button
            onClick={handleLoadTemplates}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            View Templates
          </button>
        </div>

        {/* Templates Modal */}
        {showTemplates && templates.length > 0 && (
          <div className="mb-4 bg-gray-900/80 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Available ABB Relay Templates</h3>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-white text-sm">Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.model} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <h4 className="text-white font-medium">{t.model}</h4>
                  <p className="text-gray-400 text-xs mt-1">{t.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      {t.categories.measurement} meas
                    </span>
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                      {t.categories.protection} prot
                    </span>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      {t.categories.status} status
                    </span>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                      {t.categories.energy} energy
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan Results */}
        {scanResult && (
          <div className="mt-4">
            {scanResult.identifiedModel && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <span className="text-green-400 font-medium">Relay Identified: {scanResult.identifiedModel}</span>
                  <span className="text-gray-400 text-sm ml-3">{scanResult.identifiedDescription}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">
                Discovered Points ({scanResult.totalPoints})
              </h3>
              <div className="flex gap-2">
                <button onClick={selectAllPoints} className="text-gray-400 hover:text-white text-xs">
                  {selectedPoints.size === scanResult.discoveredPoints.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleExportJSON}
                  disabled={scanResult.discoveredPoints.length === 0}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={scanResult.discoveredPoints.length === 0}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center gap-1"
                >
                  <FileDown className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-2 w-8"></th>
                    <th className="text-left py-2 px-3">Register</th>
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">Value</th>
                    <th className="text-left py-2 px-3">Unit</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Raw Hex</th>
                    <th className="text-left py-2 px-3">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResult.discoveredPoints.map((point, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer ${
                        selectedPoints.has(i) ? 'bg-cyan-500/10' : ''
                      }`}
                      onClick={() => togglePointSelection(i)}
                    >
                      <td className="py-1.5 px-2">
                        <input
                          type="checkbox"
                          checked={selectedPoints.has(i)}
                          onChange={() => togglePointSelection(i)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-cyan-400 font-mono">{point.register}</td>
                      <td className="py-1.5 px-3 text-white font-medium">{point.name || '—'}</td>
                      <td className="py-1.5 px-3 text-gray-300 text-xs">{point.description || '—'}</td>
                      <td className="py-1.5 px-3 text-yellow-300 font-mono font-medium">
                        {typeof point.value === 'boolean' ? (point.value ? 'TRUE' : 'FALSE') : point.value}
                      </td>
                      <td className="py-1.5 px-3 text-gray-400">{point.unit || '—'}</td>
                      <td className="py-1.5 px-3">
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{point.dataType}</span>
                      </td>
                      <td className="py-1.5 px-3 text-gray-400 font-mono text-xs">{point.rawHex}</td>
                      <td className="py-1.5 px-3 text-gray-400 text-xs">{point.matchedTemplate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {scanResult.discoveredPoints.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No measurement points found. The relay may use different register addresses.
                Try the manual Register Reader above with different address ranges.
              </div>
            )}
          </div>
        )}
      </section>

      {/* IEC 61850 MMS Browser */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-orange-400" />
          IEC 61850 MMS Browser
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Browse the relay's full data model tree (Logical Devices → Logical Nodes → Data Objects → Data Attributes) directly at runtime via MMS — no ICD file needed.
        </p>
        {targetIP ? (
          <IEC61850Browser host={targetIP} port={mmsPort} />
        ) : (
          <p className="text-gray-500 text-sm">Enter a relay IP address above to browse its IEC 61850 data model.</p>
        )}
      </section>

      {/* Quick Reference */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
          <ChevronRight className="w-5 h-5 text-gray-400" />
          Quick Reference: On-Site Connection Steps
        </h2>
        <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
          <li>Connect Ethernet cable from laptop to relay's <span className="text-white">rear RJ-45 port</span> (usually labeled "ETH 1")</li>
          <li>Check relay's front panel LHMI: <span className="text-white">Menu &rarr; Communication &rarr; Ethernet &rarr; IP Address</span></li>
          <li>Set laptop to same subnet (e.g., relay is 10.0.0.1 &rarr; set laptop to 10.0.0.2 / 255.255.255.0)</li>
          <li>Click <span className="text-cyan-400">"Discover Relays"</span> above, or enter the IP manually and <span className="text-yellow-400">"Test Connection"</span></li>
          <li>Click <span className="text-purple-400">"Scan Common ABB Registers"</span> to auto-detect measurements</li>
          <li><span className="text-green-400">Export</span> discovered tags as JSON/CSV for SCADA import</li>
        </ol>
      </section>
    </div>
  );
}
