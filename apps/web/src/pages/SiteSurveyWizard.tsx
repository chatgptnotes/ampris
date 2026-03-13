import { useState, useCallback } from 'react';
import {
  Building2, Layers, Wifi, CheckCircle2, Play, ArrowRight, ArrowLeft,
  Plus, Trash2, Loader2, AlertCircle, Radio, Settings2, Zap, X,
} from 'lucide-react';
import axios from 'axios';
import RelayTemplateSelector from '@/components/RelayTemplateSelector';

const API_EXPLORER = '/api/relay-explorer';
const API_DEVICES = '/api/devices';

// ─── Types ──────────────────────────────────────────

interface BayConfig {
  id: string;
  name: string;
  bayType: 'line' | 'transformer' | 'bus_coupler' | 'capacitor' | 'reactor' | 'other';
  voltageLevel: string;
  relayModel: string;
  relayIP: string;
  relayPort: number;
  slaveId: number;
  protocol: 'MODBUS_TCP' | 'IEC61850';
  connectionStatus: 'untested' | 'connected' | 'failed';
  tagCount: number;
}

interface SubstationInfo {
  name: string;
  type: '220/132kV' | '220/66kV' | '132/33kV' | '132/11kV' | '66/11kV' | '33/11kV';
  location: string;
  bayCount: number;
}

const STEPS = [
  { id: 1, title: 'Substation Info', icon: Building2, description: 'Name, type, location' },
  { id: 2, title: 'Relay Inventory', icon: Radio, description: 'Per-bay relay configuration' },
  { id: 3, title: 'Connectivity Check', icon: Wifi, description: 'Test each relay connection' },
  { id: 4, title: 'Auto-Configure', icon: Settings2, description: 'Generate tags from templates' },
  { id: 5, title: 'Start Polling', icon: Play, description: 'Review and activate' },
];

const BAY_TYPES = [
  { value: 'line', label: 'Line Bay' },
  { value: 'transformer', label: 'Transformer Bay' },
  { value: 'bus_coupler', label: 'Bus Coupler' },
  { value: 'capacitor', label: 'Capacitor Bank' },
  { value: 'reactor', label: 'Reactor' },
  { value: 'other', label: 'Other' },
];

let bayIdCounter = 0;
function nextBayId() { return `bay_${++bayIdCounter}_${Date.now()}`; }

// ─── Component ──────────────────────────────────────

export default function SiteSurveyWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Substation Info
  const [subInfo, setSubInfo] = useState<SubstationInfo>({
    name: '',
    type: '220/132kV',
    location: '',
    bayCount: 4,
  });

  // Step 2: Relay Inventory
  const [bays, setBays] = useState<BayConfig[]>([]);

  // Step 3: Connection results
  const [testingAll, setTestingAll] = useState(false);

  // Step 4: Tag generation
  const [generating, setGenerating] = useState(false);
  const [generatedDeviceIds, setGeneratedDeviceIds] = useState<string[]>([]);

  // Step 5: Start polling
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);

  // ─── Step Navigation ──────────────────────────────

  const canNext = () => {
    switch (currentStep) {
      case 1: return subInfo.name.trim().length > 0;
      case 2: return bays.length > 0 && bays.every(b => b.relayModel && b.relayIP);
      case 3: return bays.some(b => b.connectionStatus === 'connected');
      case 4: return generatedDeviceIds.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (currentStep === 1 && bays.length === 0) {
      // Auto-create bay entries from bay count
      const newBays: BayConfig[] = [];
      for (let i = 0; i < subInfo.bayCount; i++) {
        newBays.push({
          id: nextBayId(),
          name: `Bay ${i + 1}`,
          bayType: i === 0 ? 'transformer' : 'line',
          voltageLevel: subInfo.type.split('/')[0] + 'kV',
          relayModel: '',
          relayIP: '',
          relayPort: 502,
          slaveId: 1,
          protocol: 'MODBUS_TCP',
          connectionStatus: 'untested',
          tagCount: 0,
        });
      }
      setBays(newBays);
    }
    setCurrentStep(Math.min(currentStep + 1, 5));
  };

  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 1));

  // ─── Bay Management ───────────────────────────────

  const addBay = () => {
    setBays([...bays, {
      id: nextBayId(),
      name: `Bay ${bays.length + 1}`,
      bayType: 'line',
      voltageLevel: subInfo.type.split('/')[0] + 'kV',
      relayModel: '',
      relayIP: '',
      relayPort: 502,
      slaveId: 1,
      protocol: 'MODBUS_TCP',
      connectionStatus: 'untested',
      tagCount: 0,
    }]);
  };

  const removeBay = (id: string) => {
    setBays(bays.filter(b => b.id !== id));
  };

  const updateBay = (id: string, updates: Partial<BayConfig>) => {
    setBays(bays.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  // ─── Step 3: Connectivity Check ───────────────────

  const testSingleBay = useCallback(async (bay: BayConfig) => {
    if (!bay.relayIP) return;
    try {
      const { data } = await axios.post(`${API_EXPLORER}/test-connection`, {
        host: bay.relayIP,
        modbusPort: bay.protocol === 'MODBUS_TCP' ? bay.relayPort : undefined,
        mmsPort: bay.protocol === 'IEC61850' ? bay.relayPort : undefined,
      });
      const connected = bay.protocol === 'MODBUS_TCP' ? data.modbus.connected : data.mms.connected;
      updateBay(bay.id, { connectionStatus: connected ? 'connected' : 'failed' });
    } catch {
      updateBay(bay.id, { connectionStatus: 'failed' });
    }
  }, [bays]);

  const testAllBays = useCallback(async () => {
    setTestingAll(true);
    setError(null);
    // Reset all to untested
    setBays(prev => prev.map(b => ({ ...b, connectionStatus: 'untested' as const })));

    for (const bay of bays) {
      if (bay.relayIP) {
        try {
          const { data } = await axios.post(`${API_EXPLORER}/test-connection`, {
            host: bay.relayIP,
            modbusPort: bay.protocol === 'MODBUS_TCP' ? bay.relayPort : undefined,
            mmsPort: bay.protocol === 'IEC61850' ? bay.relayPort : undefined,
          });
          const connected = bay.protocol === 'MODBUS_TCP' ? data.modbus.connected : data.mms.connected;
          setBays(prev => prev.map(b =>
            b.id === bay.id ? { ...b, connectionStatus: connected ? 'connected' as const : 'failed' as const } : b
          ));
        } catch {
          setBays(prev => prev.map(b =>
            b.id === bay.id ? { ...b, connectionStatus: 'failed' as const } : b
          ));
        }
      }
    }
    setTestingAll(false);
  }, [bays]);

  // ─── Step 4: Auto-Configure ───────────────────────

  const handleAutoConfigure = useCallback(async () => {
    setGenerating(true);
    setError(null);
    const deviceIds: string[] = [];

    try {
      // We need a project ID — for now use a placeholder that the user must configure
      // In a real flow, the user would select a project first
      const connectedBays = bays.filter(b => b.connectionStatus === 'connected' && b.relayModel);

      for (const bay of connectedBays) {
        // Create external device
        const { data: device } = await axios.post(API_DEVICES, {
          name: `${subInfo.name} - ${bay.name} (${bay.relayModel})`,
          description: `${bay.bayType} relay at ${bay.relayIP}:${bay.relayPort}`,
          protocol: bay.protocol,
          host: bay.relayIP,
          port: bay.relayPort,
          slaveId: bay.slaveId,
          pollIntervalMs: 1000,
          timeoutMs: 5000,
          retryCount: 3,
          projectId: getProjectId(),
        });

        deviceIds.push(device.id);

        // Generate tags from template
        try {
          const { data: tagResult } = await axios.post(`${API_DEVICES}/${device.id}/generate-tags`, {
            templateModel: bay.relayModel,
            bayName: bay.name.replace(/\s+/g, '_'),
            prefix: subInfo.name.replace(/\s+/g, '_'),
          });
          updateBay(bay.id, { tagCount: tagResult.count });
        } catch (err: any) {
          console.warn(`Tag generation failed for ${bay.name}:`, err.message);
        }
      }

      setGeneratedDeviceIds(deviceIds);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Auto-configure failed');
    } finally {
      setGenerating(false);
    }
  }, [bays, subInfo]);

  // ─── Step 5: Start Polling ────────────────────────

  const handleStartPolling = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      await axios.post('/api/polling/start-all', { projectId: getProjectId() });
      setStarted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to start polling');
    } finally {
      setStarting(false);
    }
  }, [generatedDeviceIds]);

  // ─── Helpers ──────────────────────────────────────

  function getProjectId(): string {
    // Try to get from URL or localStorage
    const match = window.location.pathname.match(/projects\/([^/]+)/);
    if (match) return match[1];
    const stored = localStorage.getItem('ampris-active-project');
    if (stored) return stored;
    return 'default-project';
  }

  // ─── Render ───────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Building2 className="w-7 h-7 text-cyan-400" />
          Site Survey Wizard
        </h1>
        <p className="text-gray-400 mt-1">
          Step-by-step setup for a new substation with ABB protection relays
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full ${
                  isActive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                  isDone ? 'bg-green-500/10 text-green-400' :
                  'text-gray-500'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <div className="hidden lg:block text-left">
                  <div className="font-medium">{step.title}</div>
                  <div className="text-xs opacity-70">{step.description}</div>
                </div>
              </button>
              {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">

        {/* Step 1: Substation Info */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Substation Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Substation Name *</label>
                <input
                  type="text"
                  value={subInfo.name}
                  onChange={e => setSubInfo({ ...subInfo, name: e.target.value })}
                  placeholder="e.g. Dhanori 220kV Substation"
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Substation Type</label>
                <select
                  value={subInfo.type}
                  onChange={e => setSubInfo({ ...subInfo, type: e.target.value as SubstationInfo['type'] })}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="220/132kV">220/132kV</option>
                  <option value="220/66kV">220/66kV</option>
                  <option value="132/33kV">132/33kV</option>
                  <option value="132/11kV">132/11kV</option>
                  <option value="66/11kV">66/11kV</option>
                  <option value="33/11kV">33/11kV</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Location</label>
                <input
                  type="text"
                  value={subInfo.location}
                  onChange={e => setSubInfo({ ...subInfo, location: e.target.value })}
                  placeholder="e.g. Pune, Maharashtra"
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Number of Bays</label>
                <input
                  type="number"
                  value={subInfo.bayCount}
                  onChange={e => setSubInfo({ ...subInfo, bayCount: Math.max(1, Number(e.target.value)) })}
                  min={1}
                  max={50}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Relay Inventory */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                Relay Inventory ({bays.length} bays)
              </h2>
              <button onClick={addBay} className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Bay
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {bays.map((bay, i) => (
                <div key={bay.id} className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium text-sm">Bay {i + 1}</span>
                    <button onClick={() => removeBay(bay.id)} className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Bay Name</label>
                      <input
                        type="text"
                        value={bay.name}
                        onChange={e => updateBay(bay.id, { name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Bay Type</label>
                      <select
                        value={bay.bayType}
                        onChange={e => updateBay(bay.id, { bayType: e.target.value as BayConfig['bayType'] })}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      >
                        {BAY_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Voltage Level</label>
                      <input
                        type="text"
                        value={bay.voltageLevel}
                        onChange={e => updateBay(bay.id, { voltageLevel: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Protocol</label>
                      <select
                        value={bay.protocol}
                        onChange={e => updateBay(bay.id, { protocol: e.target.value as BayConfig['protocol'], relayPort: e.target.value === 'IEC61850' ? 102 : 502 })}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="MODBUS_TCP">Modbus TCP</option>
                        <option value="IEC61850">IEC 61850</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-500 text-xs mb-1">Relay Template</label>
                      <RelayTemplateSelector
                        value={bay.relayModel}
                        onChange={model => updateBay(bay.id, { relayModel: model })}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs mb-1">Relay IP Address</label>
                      <input
                        type="text"
                        value={bay.relayIP}
                        onChange={e => updateBay(bay.id, { relayIP: e.target.value })}
                        placeholder="e.g. 10.0.0.1"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Port</label>
                        <input
                          type="number"
                          value={bay.relayPort}
                          onChange={e => updateBay(bay.id, { relayPort: Number(e.target.value) })}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Slave ID</label>
                        <input
                          type="number"
                          value={bay.slaveId}
                          onChange={e => updateBay(bay.id, { slaveId: Number(e.target.value) })}
                          min={0}
                          max={255}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Connectivity Check */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wifi className="w-5 h-5 text-cyan-400" />
                Connectivity Check
              </h2>
              <button
                onClick={testAllBays}
                disabled={testingAll}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {testingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {testingAll ? 'Testing...' : 'Test All Connections'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-3">Bay</th>
                    <th className="text-left py-2 px-3">Relay</th>
                    <th className="text-left py-2 px-3">IP:Port</th>
                    <th className="text-left py-2 px-3">Protocol</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bays.map((bay) => (
                    <tr key={bay.id} className="border-b border-gray-700/50">
                      <td className="py-2 px-3 text-white">{bay.name}</td>
                      <td className="py-2 px-3 text-gray-300">{bay.relayModel || '—'}</td>
                      <td className="py-2 px-3 text-gray-300 font-mono text-xs">{bay.relayIP}:{bay.relayPort}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{bay.protocol}</span>
                      </td>
                      <td className="py-2 px-3">
                        {bay.connectionStatus === 'connected' && (
                          <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>
                        )}
                        {bay.connectionStatus === 'failed' && (
                          <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5" /> Failed</span>
                        )}
                        {bay.connectionStatus === 'untested' && (
                          <span className="text-gray-500 text-xs">Untested</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => testSingleBay(bay)}
                          disabled={testingAll || !bay.relayIP}
                          className="text-cyan-400 hover:text-cyan-300 text-xs disabled:text-gray-600"
                        >
                          Test
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-3 text-sm">
              <span className="text-green-400 font-medium">{bays.filter(b => b.connectionStatus === 'connected').length}</span>
              <span className="text-gray-400"> connected, </span>
              <span className="text-red-400 font-medium">{bays.filter(b => b.connectionStatus === 'failed').length}</span>
              <span className="text-gray-400"> failed, </span>
              <span className="text-gray-500 font-medium">{bays.filter(b => b.connectionStatus === 'untested').length}</span>
              <span className="text-gray-400"> untested</span>
            </div>
          </div>
        )}

        {/* Step 4: Auto-Configure */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-cyan-400" />
              Auto-Configure Devices & Tags
            </h2>
            <p className="text-gray-400 text-sm">
              This will create external devices and generate SCADA tags from the selected templates
              for all connected relays ({bays.filter(b => b.connectionStatus === 'connected' && b.relayModel).length} bays ready).
            </p>

            {generatedDeviceIds.length === 0 ? (
              <button
                onClick={handleAutoConfigure}
                disabled={generating || bays.filter(b => b.connectionStatus === 'connected' && b.relayModel).length === 0}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                {generating ? 'Creating devices & tags...' : 'Auto-Configure All'}
              </button>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Configuration Complete
                </div>
                <p className="text-gray-400 text-sm">
                  Created {generatedDeviceIds.length} devices with tags from templates.
                </p>
                <div className="mt-3 space-y-1">
                  {bays.filter(b => b.connectionStatus === 'connected' && b.relayModel).map(bay => (
                    <div key={bay.id} className="text-sm text-gray-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      {bay.name} — {bay.relayModel} — {bay.tagCount} tags
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Start Polling */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-cyan-400" />
              Start Polling
            </h2>

            {/* Summary */}
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-medium">Substation: {subInfo.name} ({subInfo.type})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{bays.length}</div>
                  <div className="text-gray-400 text-xs">Total Bays</div>
                </div>
                <div className="bg-gray-800 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{bays.filter(b => b.connectionStatus === 'connected').length}</div>
                  <div className="text-gray-400 text-xs">Connected</div>
                </div>
                <div className="bg-gray-800 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{generatedDeviceIds.length}</div>
                  <div className="text-gray-400 text-xs">Devices</div>
                </div>
                <div className="bg-gray-800 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{bays.reduce((sum, b) => sum + b.tagCount, 0)}</div>
                  <div className="text-gray-400 text-xs">Tags</div>
                </div>
              </div>
            </div>

            {!started ? (
              <button
                onClick={handleStartPolling}
                disabled={starting || generatedDeviceIds.length === 0}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {starting ? 'Starting...' : 'Start All Polling'}
              </button>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <div>
                  <div className="text-green-400 font-medium">Polling Started</div>
                  <p className="text-gray-400 text-sm">
                    All devices are now polling. Go to the <a href="/app/devices" className="text-cyan-400 hover:underline">Device Manager</a> or{' '}
                    <a href="/app/projects" className="text-cyan-400 hover:underline">Dashboard</a> to see live data.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={currentStep === 1}
          className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {currentStep < 5 && (
          <button
            onClick={goNext}
            disabled={!canNext()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
