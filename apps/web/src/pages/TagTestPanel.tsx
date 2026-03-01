import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import {
  Play, Pause, Square, StepForward, RotateCcw, Save, Trash2, Plus, X,
  Code2, FlaskConical, SlidersHorizontal, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  description?: string;
  type: string;
  dataType: string;
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
  liveValue?: any;
  group?: string | null;
}

interface TagHistory {
  value: string;
  timestamp: string;
}

interface ScriptData {
  id: string;
  name: string;
  code: string;
  category?: string;
}

interface ScenarioStep {
  delay: number;
  tagName: string;
  value: string | number | boolean;
}

interface ScenarioData {
  id: string;
  name: string;
  steps: ScenarioStep[];
}

// Mini sparkline component
function Sparkline({ data, width = 120, height = 30 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-gray-50 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="bg-gray-50 rounded">
      <polyline points={points} fill="none" stroke="#3B82F6" strokeWidth={1.5} />
    </svg>
  );
}

// ─── Tag Control Card ────────────────────────
function TagControlCard({
  tag, history, onSetValue,
}: {
  tag: TagData; history: TagHistory[]; onSetValue: (tagName: string, value: any) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const numericHistory = history
    .map((h) => parseFloat(h.value))
    .filter((v) => !isNaN(v))
    .slice(-30);

  const handleSet = () => {
    let val: any = inputValue;
    if (tag.dataType === 'BOOLEAN') val = inputValue === 'true' || inputValue === '1';
    else if (tag.dataType === 'INTEGER') val = parseInt(inputValue, 10);
    else if (tag.dataType === 'FLOAT') val = parseFloat(inputValue);
    onSetValue(tag.name, val);
    setInputValue('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium text-gray-800 text-sm">{tag.name}</div>
          {tag.description && <div className="text-xs text-gray-400">{tag.description}</div>}
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-blue-600">
            {tag.liveValue !== undefined && tag.liveValue !== null
              ? typeof tag.liveValue === 'boolean'
                ? tag.liveValue ? 'TRUE' : 'FALSE'
                : typeof tag.liveValue === 'number'
                  ? tag.liveValue.toFixed(tag.dataType === 'INTEGER' ? 0 : 2)
                  : String(tag.liveValue)
              : '—'}
          </div>
          {tag.unit && <div className="text-xs text-gray-400">{tag.unit}</div>}
        </div>
      </div>

      {/* Control area */}
      {tag.dataType === 'BOOLEAN' ? (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onSetValue(tag.name, !(tag.liveValue === true || tag.liveValue === 'true'))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              tag.liveValue === true || tag.liveValue === 'true' ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              tag.liveValue === true || tag.liveValue === 'true' ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
          <span className="text-xs text-gray-500">
            {tag.liveValue === true || tag.liveValue === 'true' ? 'ON' : 'OFF'}
          </span>
        </div>
      ) : tag.dataType === 'STRING' ? (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSet()}
            placeholder="Enter value..."
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button onClick={handleSet} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Set</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {tag.minValue != null && tag.maxValue != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-10 text-right">{tag.minValue}</span>
              <input
                type="range"
                min={tag.minValue}
                max={tag.maxValue}
                step={tag.dataType === 'INTEGER' ? 1 : (tag.maxValue - tag.minValue) / 100}
                value={typeof tag.liveValue === 'number' ? tag.liveValue : tag.minValue}
                onChange={(e) => onSetValue(tag.name, tag.dataType === 'INTEGER' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
                className="flex-1 h-2 accent-blue-600"
              />
              <span className="text-xs text-gray-400 w-10">{tag.maxValue}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSet()}
              placeholder="Value"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <button onClick={handleSet} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Set</button>
          </div>
        </div>
      )}

      {/* Sparkline */}
      {numericHistory.length > 1 && (
        <div className="mt-2">
          <Sparkline data={numericHistory} width={260} height={28} />
        </div>
      )}

      {/* Recent history */}
      {history.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] text-gray-400 mb-1">Recent values:</div>
          <div className="flex flex-wrap gap-1">
            {history.slice(-8).reverse().map((h, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">
                {h.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Script Templates ────────────────────────
const SCRIPT_TEMPLATES = [
  {
    name: 'Emergency Trip',
    category: 'Safety',
    code: `// Emergency Trip - Open all breakers
setTag("CB1.status", 0);
setTag("CB2.status", 0);
setTag("ALARM.emergency", 1);
log("Emergency trip executed");`,
  },
  {
    name: 'Load Shedding',
    category: 'Operations',
    code: `// Load Shedding Sequence
setTag("FEEDER1.status", 0);
setTag("FEEDER2.status", 0);
log("Load shedding activated - feeders disconnected");`,
  },
  {
    name: 'Voltage Regulation Test',
    category: 'Testing',
    code: `// Voltage Regulation Test
const v = getTag("BUS1.voltage");
if (v > 35) {
  setTag("ALARM.overvoltage", 1);
  log("Overvoltage detected: " + v);
} else {
  setTag("ALARM.overvoltage", 0);
  log("Voltage normal: " + v);
}`,
  },
];

export default function TagTestPanel() {
  const [activeTab, setActiveTab] = useState<'controls' | 'scripts' | 'scenarios'>('controls');
  const [tags, setTags] = useState<TagData[]>([]);
  const [tagHistories, setTagHistories] = useState<Record<string, TagHistory[]>>({});
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<NodeJS.Timeout>();

  // Script state
  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [scriptCode, setScriptCode] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptLog, setScriptLog] = useState<string[]>([]);
  const [runningScript, setRunningScript] = useState(false);

  // Scenario state
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioData | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [scenarioStep, setScenarioStep] = useState(-1);
  const [scenarioPaused, setScenarioPaused] = useState(false);
  const [scenarioLoop, setScenarioLoop] = useState(false);
  const scenarioTimerRef = useRef<NodeJS.Timeout>();
  const [showNewScenario, setShowNewScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioSteps, setNewScenarioSteps] = useState<ScenarioStep[]>([{ delay: 0, tagName: '', value: '' }]);

  // Bulk set state
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState('');

  const loadTags = useCallback(async () => {
    try {
      const { data } = await api.get('/tags');
      setTags(data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistories = useCallback(async () => {
    try {
      const { data } = await api.get('/tags/values/all');
      // Build simple history from current polling
      setTagHistories((prev) => {
        const next = { ...prev };
        for (const [name, val] of Object.entries(data) as [string, any][]) {
          const hist = next[name] || [];
          hist.push({ value: String(val.value), timestamp: new Date().toISOString() });
          if (hist.length > 50) hist.shift();
          next[name] = hist;
        }
        return next;
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadTags();
    loadHistories();
    refreshTimer.current = setInterval(() => { loadTags(); loadHistories(); }, 2000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [loadTags, loadHistories]);

  useEffect(() => {
    api.get('/tags/scripts').then(({ data }) => setScripts(data)).catch(() => {});
    api.get('/tags/scenarios').then(({ data }) => setScenarios(data)).catch(() => {});
  }, []);

  const setTagValue = useCallback(async (tagName: string, value: any) => {
    try {
      await api.post('/tags/by-name/set-value', { tagName, value });
      // Quick refresh
      setTimeout(loadTags, 200);
    } catch (err) {
      console.error('Failed to set tag value:', err);
    }
  }, [loadTags]);

  const handleBulkSet = async () => {
    if (selectedTags.size === 0 || !bulkValue) return;
    const values = [...selectedTags].map((tagName) => ({ tagName, value: isNaN(Number(bulkValue)) ? bulkValue : Number(bulkValue) }));
    try {
      await api.post('/tags/bulk-set', { values });
      setSelectedTags(new Set());
      setBulkValue('');
      setTimeout(loadTags, 200);
    } catch (err) {
      console.error('Bulk set failed:', err);
    }
  };

  // Script execution
  const runScript = async () => {
    if (!scriptCode.trim()) return;
    setRunningScript(true);
    try {
      const { data } = await api.post('/tags/execute-script', { code: scriptCode });
      setScriptLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ${data.success ? 'SUCCESS' : 'ERROR'}`,
        ...(data.log || []).map((l: string) => `  > ${l}`),
        ...(data.error ? [`  ERROR: ${data.error}`] : []),
      ]);
      setTimeout(loadTags, 300);
    } catch (err: any) {
      setScriptLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] FAILED: ${err.message}`]);
    } finally {
      setRunningScript(false);
    }
  };

  const saveScript = async () => {
    if (!scriptName.trim() || !scriptCode.trim()) return;
    try {
      const { data } = await api.post('/tags/scripts', { name: scriptName, code: scriptCode });
      setScripts((prev) => [data, ...prev]);
      setScriptName('');
    } catch (err) {
      console.error('Failed to save script:', err);
    }
  };

  const deleteScript = async (id: string) => {
    try {
      await api.delete(`/tags/scripts/${id}`);
      setScripts((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete script:', err);
    }
  };

  // Scenario execution
  const runScenario = useCallback(() => {
    if (!activeScenario || activeScenario.steps.length === 0) return;
    setScenarioRunning(true);
    setScenarioPaused(false);
    setScenarioStep(0);

    const executeSteps = (startIdx: number) => {
      if (startIdx >= activeScenario.steps.length) {
        if (scenarioLoop) {
          setScenarioStep(0);
          executeSteps(0);
        } else {
          setScenarioRunning(false);
          setScenarioStep(-1);
        }
        return;
      }

      const step = activeScenario.steps[startIdx];
      setScenarioStep(startIdx);

      const doExecute = () => {
        setTagValue(step.tagName, step.value);
        scenarioTimerRef.current = setTimeout(() => executeSteps(startIdx + 1), 0);
      };

      if (step.delay > 0) {
        scenarioTimerRef.current = setTimeout(doExecute, step.delay * 1000);
      } else {
        doExecute();
      }
    };

    executeSteps(0);
  }, [activeScenario, scenarioLoop, setTagValue]);

  const stopScenario = () => {
    if (scenarioTimerRef.current) clearTimeout(scenarioTimerRef.current);
    setScenarioRunning(false);
    setScenarioPaused(false);
    setScenarioStep(-1);
  };

  const pauseScenario = () => {
    if (scenarioTimerRef.current) clearTimeout(scenarioTimerRef.current);
    setScenarioPaused(true);
  };

  const saveNewScenario = async () => {
    if (!newScenarioName.trim() || newScenarioSteps.length === 0) return;
    try {
      const { data } = await api.post('/tags/scenarios', {
        name: newScenarioName,
        steps: newScenarioSteps.filter((s) => s.tagName),
      });
      setScenarios((prev) => [data, ...prev]);
      setShowNewScenario(false);
      setNewScenarioName('');
      setNewScenarioSteps([{ delay: 0, tagName: '', value: '' }]);
    } catch (err) {
      console.error('Failed to save scenario:', err);
    }
  };

  const deleteScenario = async (id: string) => {
    try {
      await api.delete(`/tags/scenarios/${id}`);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      if (activeScenario?.id === id) setActiveScenario(null);
    } catch (err) {
      console.error('Failed to delete scenario:', err);
    }
  };

  const internalTags = tags.filter((t) => t.type === 'INTERNAL' || t.type === 'SIMULATED');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">Tag Test Panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manipulate tag values, run scripts, and execute test scenarios</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
        {[
          { key: 'controls' as const, icon: SlidersHorizontal, label: 'Tag Controls' },
          { key: 'scripts' as const, icon: Code2, label: 'Scripts' },
          { key: 'scenarios' as const, icon: FlaskConical, label: 'Scenarios' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ─── Controls Tab ─── */}
        {activeTab === 'controls' && (
          <div className="p-6">
            {/* Bulk set bar */}
            {selectedTags.size > 0 && (
              <div className="mb-4 bg-blue-50 rounded-lg p-3 flex items-center gap-3">
                <span className="text-sm text-blue-700 font-medium">{selectedTags.size} tags selected</span>
                <input
                  type="text"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="Value for all"
                  className="px-3 py-1.5 text-sm border border-blue-200 rounded text-gray-700 bg-white"
                />
                <button onClick={handleBulkSet} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                  Set All
                </button>
                <button onClick={() => setSelectedTags(new Set())} className="text-sm text-blue-600 hover:underline ml-auto">
                  Clear selection
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading tags...</div>
            ) : internalTags.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <SlidersHorizontal className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No internal or simulated tags</p>
                <p className="text-sm mt-1">Create tags in the Tag Manager first</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {internalTags.map((tag) => (
                  <div key={tag.id} className="relative">
                    <input
                      type="checkbox"
                      checked={selectedTags.has(tag.name)}
                      onChange={(e) => {
                        const next = new Set(selectedTags);
                        if (e.target.checked) next.add(tag.name);
                        else next.delete(tag.name);
                        setSelectedTags(next);
                      }}
                      className="absolute top-3 left-3 z-10"
                    />
                    <div className="pl-8">
                      <TagControlCard
                        tag={tag}
                        history={tagHistories[tag.name] || []}
                        onSetValue={setTagValue}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Scripts Tab ─── */}
        {activeTab === 'scripts' && (
          <div className="flex h-full">
            {/* Editor */}
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="Script name (for saving)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={saveScript}
                  disabled={!scriptName.trim() || !scriptCode.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={runScript}
                  disabled={runningScript || !scriptCode.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {runningScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Script
                </button>
              </div>
              <textarea
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                rows={15}
                placeholder={`// Available functions:\n// setTag("tagName", value)  - Set a tag value\n// getTag("tagName")         - Get current tag value\n// log("message")            - Log a message\n\n// Example:\nif (getTag("voltage_bus1") > 35) {\n  setTag("ALARM.overvoltage", 1);\n}`}
                className="flex-1 px-4 py-3 text-sm font-mono border border-gray-200 rounded-lg text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                spellCheck={false}
              />

              {/* Script log */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">Execution Log</span>
                  <button onClick={() => setScriptLog([])} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                </div>
                <div className="h-32 overflow-auto bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400">
                  {scriptLog.length === 0 ? (
                    <span className="text-gray-600">No output yet. Run a script to see results.</span>
                  ) : (
                    scriptLog.map((line, i) => <div key={i}>{line}</div>)
                  )}
                </div>
              </div>
            </div>

            {/* Saved scripts + templates sidebar */}
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Templates</h3>
              </div>
              <div className="p-2 space-y-1">
                {SCRIPT_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    onClick={() => { setScriptCode(tmpl.code); setScriptName(tmpl.name); }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-gray-700"
                  >
                    <div className="font-medium">{tmpl.name}</div>
                    <div className="text-xs text-gray-400">{tmpl.category}</div>
                  </button>
                ))}
              </div>
              {scripts.length > 0 && (
                <>
                  <div className="p-4 border-b border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">Saved Scripts</h3>
                  </div>
                  <div className="p-2 space-y-1">
                    {scripts.map((s) => (
                      <div key={s.id} className="flex items-center gap-1">
                        <button
                          onClick={() => { setScriptCode(s.code); setScriptName(s.name); }}
                          className="flex-1 text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-gray-700"
                        >
                          {s.name}
                        </button>
                        <button onClick={() => deleteScript(s.id)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── Scenarios Tab ─── */}
        {activeTab === 'scenarios' && (
          <div className="flex h-full">
            {/* Main area */}
            <div className="flex-1 p-6">
              {activeScenario ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{activeScenario.name}</h2>
                      <p className="text-sm text-gray-500">{activeScenario.steps.length} steps</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={scenarioLoop}
                          onChange={(e) => setScenarioLoop(e.target.checked)}
                          className="rounded"
                        />
                        Loop
                      </label>
                      {!scenarioRunning ? (
                        <button onClick={runScenario} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <Play className="w-4 h-4" /> Play
                        </button>
                      ) : (
                        <>
                          <button onClick={pauseScenario} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                            <Pause className="w-4 h-4" /> Pause
                          </button>
                          <button onClick={stopScenario} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                            <Square className="w-4 h-4" /> Stop
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {scenarioRunning && activeScenario.steps.length > 0 && (
                    <div className="mb-4">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${((scenarioStep + 1) / activeScenario.steps.length) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Step {scenarioStep + 1} of {activeScenario.steps.length}</div>
                    </div>
                  )}

                  {/* Steps table */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2 font-medium text-gray-600 w-16">#</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600 w-24">Delay</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Tag</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Value</th>
                          <th className="text-center px-4 py-2 font-medium text-gray-600 w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScenario.steps.map((step, i) => (
                          <tr
                            key={i}
                            className={`border-b border-gray-100 ${
                              scenarioStep === i ? 'bg-blue-50' : scenarioStep > i ? 'bg-green-50' : ''
                            }`}
                          >
                            <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-2 text-gray-600">{step.delay}s</td>
                            <td className="px-4 py-2 font-mono text-gray-800">{step.tagName}</td>
                            <td className="px-4 py-2 font-mono text-blue-600">{String(step.value)}</td>
                            <td className="px-4 py-2 text-center">
                              {scenarioStep > i ? (
                                <span className="text-green-600 text-xs">Done</span>
                              ) : scenarioStep === i ? (
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin mx-auto" />
                              ) : (
                                <span className="text-gray-400 text-xs">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-16">
                  <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Select a scenario</p>
                  <p className="text-sm mt-1">Choose from the sidebar or create a new one</p>
                </div>
              )}
            </div>

            {/* Scenarios sidebar */}
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Scenarios</h3>
                <button onClick={() => setShowNewScenario(true)} className="p-1 text-gray-400 hover:text-blue-600" title="New Scenario">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {scenarios.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No scenarios yet</p>
                ) : (
                  scenarios.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveScenario(s)}
                        className={`flex-1 text-left px-3 py-2 text-sm rounded-lg ${
                          activeScenario?.id === s.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.steps.length} steps</div>
                      </button>
                      <button onClick={() => deleteScenario(s.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Scenario Modal */}
      {showNewScenario && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">New Test Scenario</h2>
              <button onClick={() => setShowNewScenario(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Name</label>
                <input
                  type="text"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g. Overload Test"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Steps</label>
                <div className="space-y-2">
                  {newScenarioSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                      <input
                        type="number"
                        value={step.delay}
                        onChange={(e) => {
                          const steps = [...newScenarioSteps];
                          steps[i] = { ...steps[i], delay: Number(e.target.value) };
                          setNewScenarioSteps(steps);
                        }}
                        placeholder="Delay (s)"
                        className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-700"
                      />
                      <span className="text-xs text-gray-400">s</span>
                      <input
                        type="text"
                        value={step.tagName}
                        onChange={(e) => {
                          const steps = [...newScenarioSteps];
                          steps[i] = { ...steps[i], tagName: e.target.value };
                          setNewScenarioSteps(steps);
                        }}
                        placeholder="Tag name"
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-700"
                      />
                      <span className="text-xs text-gray-400">=</span>
                      <input
                        type="text"
                        value={String(step.value)}
                        onChange={(e) => {
                          const steps = [...newScenarioSteps];
                          const v = e.target.value;
                          steps[i] = { ...steps[i], value: isNaN(Number(v)) ? v : Number(v) };
                          setNewScenarioSteps(steps);
                        }}
                        placeholder="Value"
                        className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-700"
                      />
                      <button
                        onClick={() => setNewScenarioSteps(newScenarioSteps.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewScenarioSteps([...newScenarioSteps, { delay: 0, tagName: '', value: '' }])}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowNewScenario(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={saveNewScenario}
                disabled={!newScenarioName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
