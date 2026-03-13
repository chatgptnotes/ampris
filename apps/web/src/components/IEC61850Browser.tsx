import { useState, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Server, Box, Database, Tag,
  Loader2, Download, CheckSquare, Square, FileDown,
} from 'lucide-react';
import axios from 'axios';

const API = '/api/relay-explorer';

// ─── Types ──────────────────────────────────────────

interface DataAttribute {
  name: string;
  reference: string;
  fc: string;
  type: string;
  value?: number | boolean | string;
}

interface DataObject {
  name: string;
  cdcType?: string;
  dataAttributes: DataAttribute[];
}

interface LogicalNode {
  name: string;
  lnClass: string;
  dataObjects: DataObject[];
}

interface LogicalDevice {
  name: string;
  logicalNodes: LogicalNode[];
}

interface MmsServerDirectory {
  logicalDevices: LogicalDevice[];
}

interface MeasurementPoint {
  reference: string;
  logicalDevice: string;
  logicalNode: string;
  lnClass: string;
  dataObject: string;
  description: string;
  unit?: string;
  type: 'analog' | 'digital' | 'status';
}

// ─── LN Class Colors ────────────────────────────────

const LN_COLORS: Record<string, string> = {
  MMXU: 'text-green-400',
  MSQI: 'text-green-300',
  MMTR: 'text-green-500',
  XCBR: 'text-blue-400',
  XSWI: 'text-blue-300',
  PTOC: 'text-red-400',
  PDIS: 'text-red-300',
  PDIF: 'text-red-500',
  PTRC: 'text-orange-400',
  RREC: 'text-yellow-400',
  CSWI: 'text-purple-400',
  GGIO: 'text-gray-400',
  LLN0: 'text-gray-500',
  LPHD: 'text-gray-500',
};

const LN_DESCRIPTIONS: Record<string, string> = {
  MMXU: 'Measurement',
  MSQI: 'Sequence/Imbalance',
  MMTR: 'Metering',
  XCBR: 'Circuit Breaker',
  XSWI: 'Switch/Disconnector',
  PTOC: 'Overcurrent',
  PDIS: 'Distance',
  PDIF: 'Differential',
  PTRC: 'Trip Conditioning',
  RREC: 'Auto-Reclose',
  RBRF: 'Breaker Failure',
  CSWI: 'Switch Control',
  GGIO: 'Generic I/O',
  LLN0: 'Node Zero',
  LPHD: 'Physical Device',
  PTOV: 'Overvoltage',
  PTUV: 'Undervoltage',
  PTOF: 'Overfrequency',
  PTUF: 'Underfrequency',
};

// ─── Props ──────────────────────────────────────────

interface Props {
  host: string;
  port?: number;
}

// ─── Component ──────────────────────────────────────

export default function IEC61850Browser({ host, port = 102 }: Props) {
  const [model, setModel] = useState<MmsServerDirectory | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementPoint[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [discoveringMeasurements, setDiscoveringMeasurements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLDs, setExpandedLDs] = useState<Set<string>>(new Set());
  const [expandedLNs, setExpandedLNs] = useState<Set<string>>(new Set());
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [exportingICD, setExportingICD] = useState(false);

  // ─── Browse ─────────────────────────────────────

  const handleBrowse = useCallback(async () => {
    setBrowsing(true);
    setError(null);
    setModel(null);
    try {
      const { data } = await axios.post(`${API}/mms-browse`, { host, port });
      if (data.status === 'not_yet_implemented') {
        // Fallback: try the full browse endpoint
        const { data: browseData } = await axios.post(`${API}/mms-browse-full`, { host, port });
        setModel(browseData.model);
        // Auto-expand all LDs
        setExpandedLDs(new Set(browseData.model.logicalDevices.map((ld: LogicalDevice) => ld.name)));
      } else if (data.model) {
        setModel(data.model);
        setExpandedLDs(new Set(data.model.logicalDevices.map((ld: LogicalDevice) => ld.name)));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally {
      setBrowsing(false);
    }
  }, [host, port]);

  // ─── Discover Measurements ────────────────────────

  const handleDiscoverMeasurements = useCallback(async () => {
    setDiscoveringMeasurements(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/mms-discover-measurements`, { host, port });
      setMeasurements(data.measurements || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setDiscoveringMeasurements(false);
    }
  }, [host, port]);

  // ─── Export ICD ───────────────────────────────────

  const handleExportICD = useCallback(async () => {
    setExportingICD(true);
    try {
      const { data } = await axios.post(`${API}/mms-export-icd`, { host, port }, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${host.replace(/\./g, '_')}_model.icd`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setExportingICD(false);
    }
  }, [host, port]);

  // ─── Tree Expand/Collapse ─────────────────────────

  const toggleLD = (name: string) => {
    setExpandedLDs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleLN = (key: string) => {
    setExpandedLNs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleRef = (ref: string) => {
    setSelectedRefs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref); else next.add(ref);
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleBrowse}
          disabled={browsing || !host}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {browsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
          Browse Server
        </button>
        <button
          onClick={handleDiscoverMeasurements}
          disabled={discoveringMeasurements || !host}
          className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {discoveringMeasurements ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
          Discover Measurements
        </button>
        {model && (
          <button
            onClick={handleExportICD}
            disabled={exportingICD}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {exportingICD ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Export as ICD
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Tree View */}
      {model && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 max-h-[60vh] overflow-y-auto font-mono text-sm">
          {model.logicalDevices.length === 0 && (
            <div className="text-gray-500 text-center py-4">No logical devices found</div>
          )}
          {model.logicalDevices.map((ld) => (
            <div key={ld.name}>
              {/* Logical Device */}
              <button
                onClick={() => toggleLD(ld.name)}
                className="flex items-center gap-1.5 py-1 px-1 hover:bg-gray-800 rounded w-full text-left"
              >
                {expandedLDs.has(ld.name) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-400">{ld.name}</span>
                <span className="text-gray-600 text-xs ml-2">({ld.logicalNodes.length} LNs)</span>
              </button>

              {expandedLDs.has(ld.name) && (
                <div className="ml-5 border-l border-gray-700/50 pl-2">
                  {ld.logicalNodes.map((ln) => {
                    const lnKey = `${ld.name}/${ln.name}`;
                    const colorClass = LN_COLORS[ln.lnClass] || 'text-gray-400';
                    const desc = LN_DESCRIPTIONS[ln.lnClass] || ln.lnClass;
                    return (
                      <div key={lnKey}>
                        {/* Logical Node */}
                        <button
                          onClick={() => toggleLN(lnKey)}
                          className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-gray-800 rounded w-full text-left"
                        >
                          {expandedLNs.has(lnKey) ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                          <Box className={`w-3 h-3 ${colorClass}`} />
                          <span className={colorClass}>{ln.name}</span>
                          <span className="text-gray-600 text-xs ml-2">{desc}</span>
                          <span className="text-gray-700 text-xs ml-1">({ln.dataObjects.length} DOs)</span>
                        </button>

                        {expandedLNs.has(lnKey) && (
                          <div className="ml-5 border-l border-gray-700/30 pl-2">
                            {ln.dataObjects.map((dataObj) => {
                              const ref = `${ld.name}/${ln.name}$MX$${dataObj.name}`;
                              return (
                                <div
                                  key={dataObj.name}
                                  className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-gray-800 rounded cursor-pointer"
                                  onClick={() => toggleRef(ref)}
                                >
                                  {selectedRefs.has(ref) ? (
                                    <CheckSquare className="w-3 h-3 text-cyan-400" />
                                  ) : (
                                    <Square className="w-3 h-3 text-gray-600" />
                                  )}
                                  <Database className="w-3 h-3 text-yellow-400/70" />
                                  <span className="text-gray-300">{dataObj.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Discovered Measurements */}
      {measurements.length > 0 && (
        <div>
          <h3 className="text-white font-medium mb-2">Discovered Measurements ({measurements.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-3">Reference</th>
                  <th className="text-left py-2 px-3">LN Class</th>
                  <th className="text-left py-2 px-3">Description</th>
                  <th className="text-left py-2 px-3">Unit</th>
                  <th className="text-left py-2 px-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-1.5 px-3 text-cyan-400 font-mono text-xs">{m.reference}</td>
                    <td className="py-1.5 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${LN_COLORS[m.lnClass] || 'text-gray-400'} bg-gray-800`}>
                        {m.lnClass}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-gray-300">{m.description}</td>
                    <td className="py-1.5 px-3 text-gray-400">{m.unit || '—'}</td>
                    <td className="py-1.5 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        m.type === 'analog' ? 'bg-green-500/10 text-green-400' :
                        m.type === 'digital' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
