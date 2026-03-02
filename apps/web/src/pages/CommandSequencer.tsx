import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import {
  Terminal, Plus, Play, Trash2, Edit, ChevronUp, ChevronDown,
  CheckCircle, XCircle, Loader2, AlertTriangle, Clock, X, Square
} from 'lucide-react';

interface Step {
  order: number;
  type: string;
  tagName?: string;
  action?: string;
  value?: string;
  condition?: { tagName: string; operator: string; value: string };
  timeout?: number;
  description?: string;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: Step[];
  requiresAuth: boolean;
  authorityLevel: number;
  isEmergency: boolean;
  projectId: string;
}

interface Execution {
  id: string;
  sequenceId: string;
  sequenceName: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  startedBy: string;
  stepResults: any[];
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

const CATEGORIES = ['SWITCHING', 'STARTUP', 'SHUTDOWN', 'EMERGENCY', 'CUSTOM'];
const STEP_TYPES = [
  { value: 'SET_VALUE', label: 'Set Value' },
  { value: 'CHECK_CONDITION', label: 'Check Condition' },
  { value: 'WAIT', label: 'Wait' },
  { value: 'CONFIRM_OPERATOR', label: 'Operator Confirm' },
  { value: 'LOG_EVENT', label: 'Log Event' },
];
const OPERATORS = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '!=' },
  { value: 'gt', label: '>' }, { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' }, { value: 'lte', label: '<=' },
];

const categoryColors: Record<string, string> = {
  SWITCHING: 'bg-blue-600', STARTUP: 'bg-green-600', SHUTDOWN: 'bg-orange-600',
  EMERGENCY: 'bg-red-600', CUSTOM: 'bg-purple-600',
};

export default function CommandSequencer() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Sequence | null>(null);
  const [activeExecution, setActiveExecution] = useState<Execution | null>(null);
  const [tab, setTab] = useState<'sequences' | 'history'>('sequences');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formAuthLevel, setFormAuthLevel] = useState(1);
  const [formEmergency, setFormEmergency] = useState(false);
  const [formSteps, setFormSteps] = useState<Step[]>([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [seqRes, execRes, tagRes] = await Promise.all([
      api.get('/commands', { params: { projectId } }),
      api.get('/commands/executions', { params: { projectId } }),
      api.get('/tags', { params: { projectId } }),
    ]);
    setSequences(seqRes.data);
    setExecutions(execRes.data);
    setTags(tagRes.data);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // WebSocket listeners
  useEffect(() => {
    const handleStepComplete = (data: any) => {
      setActiveExecution(prev => {
        if (!prev || prev.id !== data.executionId) return prev;
        return { ...prev, currentStep: data.step + 1, stepResults: [...prev.stepResults, data.result] };
      });
    };
    const handleCompleted = (data: any) => {
      setActiveExecution(prev => prev?.id === data.executionId ? { ...prev, status: 'COMPLETED' } : prev);
      load();
    };
    const handleFailed = (data: any) => {
      setActiveExecution(prev => prev?.id === data.executionId ? { ...prev, status: 'FAILED', errorMessage: data.reason } : prev);
      load();
    };
    const handleWaiting = (data: any) => {
      setActiveExecution(prev => prev?.id === data.executionId ? { ...prev, status: 'PAUSED' } : prev);
    };
    // We'd attach these to socket.io in production. For now they're stubs.
    return () => {};
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormName(''); setFormDesc(''); setFormCategory(''); setFormAuthLevel(1); setFormEmergency(false); setFormSteps([]);
    setShowModal(true);
  };

  const openEdit = (seq: Sequence) => {
    setEditing(seq);
    setFormName(seq.name); setFormDesc(seq.description || ''); setFormCategory(seq.category || '');
    setFormAuthLevel(seq.authorityLevel); setFormEmergency(seq.isEmergency);
    setFormSteps(seq.steps || []);
    setShowModal(true);
  };

  const save = async () => {
    const payload = {
      name: formName, description: formDesc || undefined, category: formCategory || undefined,
      steps: formSteps, authorityLevel: formAuthLevel, isEmergency: formEmergency, projectId,
    };
    if (editing) await api.put(`/commands/${editing.id}`, payload);
    else await api.post('/commands', payload);
    setShowModal(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this sequence?')) return;
    await api.delete(`/commands/${id}`);
    load();
  };

  const execute = async (seq: Sequence) => {
    if (!confirm(`Execute "${seq.name}"? This will run ${seq.steps.length} steps.`)) return;
    const { data } = await api.post(`/commands/${seq.id}/execute`);
    setActiveExecution(data);
    setTimeout(load, 2000);
  };

  const confirmStep = async () => {
    if (!activeExecution) return;
    await api.post(`/commands/executions/${activeExecution.id}/confirm`);
    setActiveExecution(prev => prev ? { ...prev, status: 'RUNNING' } : prev);
  };

  const abort = async () => {
    if (!activeExecution) return;
    await api.post(`/commands/executions/${activeExecution.id}/abort`);
    setActiveExecution(prev => prev ? { ...prev, status: 'ABORTED' } : prev);
    load();
  };

  const addStep = () => {
    setFormSteps([...formSteps, { order: formSteps.length, type: 'SET_VALUE', description: '' }]);
  };

  const updateStep = (i: number, updates: Partial<Step>) => {
    const next = [...formSteps];
    next[i] = { ...next[i], ...updates };
    setFormSteps(next);
  };

  const removeStep = (i: number) => {
    setFormSteps(formSteps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })));
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    if (i + dir < 0 || i + dir >= formSteps.length) return;
    const next = [...formSteps];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setFormSteps(next.map((s, idx) => ({ ...s, order: idx })));
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-600', FAILED: 'bg-red-600', RUNNING: 'bg-blue-600',
      ABORTED: 'bg-gray-600', PAUSED: 'bg-yellow-600', PENDING: 'bg-gray-500',
    };
    return <span className={`px-2 py-0.5 rounded text-xs text-white ${colors[status] || 'bg-gray-500'}`}>{status}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Command Sequencer</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('sequences')} className={`px-3 py-1.5 rounded text-sm ${tab === 'sequences' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Sequences</button>
          <button onClick={() => setTab('history')} className={`px-3 py-1.5 rounded text-sm ${tab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>History</button>
          <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Sequence
          </button>
        </div>
      </div>

      {/* Active Execution Panel */}
      {activeExecution && (
        <div className="bg-gray-800 border border-blue-500 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className={`w-5 h-5 ${activeExecution.status === 'RUNNING' ? 'animate-spin text-blue-400' : activeExecution.status === 'COMPLETED' ? 'text-green-400' : 'text-red-400'}`} />
              <span className="font-semibold text-white">{activeExecution.sequenceName}</span>
              {statusBadge(activeExecution.status)}
            </div>
            <div className="flex gap-2">
              {activeExecution.status === 'PAUSED' && (
                <button onClick={confirmStep} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Confirm</button>
              )}
              {['RUNNING', 'PAUSED'].includes(activeExecution.status) && (
                <button onClick={abort} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1">
                  <Square className="w-3 h-3" /> Abort
                </button>
              )}
              <button onClick={() => setActiveExecution(null)} className="p-1 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="text-sm text-gray-400">Step {activeExecution.currentStep} / {activeExecution.totalSteps} | By: {activeExecution.startedBy}</div>
          <div className="space-y-1">
            {activeExecution.stepResults.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.status === 'SUCCESS' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="text-gray-300">Step {r.step}: {r.message}</span>
                <span className="text-gray-500 text-xs">{r.timestamp}</span>
              </div>
            ))}
          </div>
          {activeExecution.errorMessage && <div className="text-sm text-red-400">Error: {activeExecution.errorMessage}</div>}
        </div>
      )}

      {tab === 'sequences' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map(seq => (
            <div key={seq.id} className={`bg-gray-800 border rounded-lg p-4 space-y-3 ${seq.isEmergency ? 'border-red-500' : 'border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{seq.name}</h3>
                {seq.isEmergency && <AlertTriangle className="w-4 h-4 text-red-400" />}
              </div>
              {seq.category && <span className={`px-2 py-0.5 rounded text-xs text-white ${categoryColors[seq.category] || 'bg-gray-600'}`}>{seq.category}</span>}
              <div className="text-sm text-gray-400">{seq.steps.length} steps · Level {seq.authorityLevel}</div>
              {seq.description && <p className="text-sm text-gray-500 line-clamp-2">{seq.description}</p>}
              <div className="flex gap-2">
                <button onClick={() => execute(seq)} className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  <Play className="w-3 h-3" /> Execute
                </button>
                <button onClick={() => openEdit(seq)} className="p-1 text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                <button onClick={() => del(seq.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {sequences.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No command sequences yet. Create one to get started.</div>}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700"><tr>
              <th className="px-4 py-2 text-left text-gray-300">Sequence</th>
              <th className="px-4 py-2 text-left text-gray-300">Status</th>
              <th className="px-4 py-2 text-left text-gray-300">Steps</th>
              <th className="px-4 py-2 text-left text-gray-300">Started By</th>
              <th className="px-4 py-2 text-left text-gray-300">Started</th>
            </tr></thead>
            <tbody>
              {executions.map(exec => (
                <tr key={exec.id} className="border-t border-gray-700 hover:bg-gray-750 cursor-pointer" onClick={() => setActiveExecution(exec)}>
                  <td className="px-4 py-2 text-white">{exec.sequenceName}</td>
                  <td className="px-4 py-2">{statusBadge(exec.status)}</td>
                  <td className="px-4 py-2 text-gray-300">{exec.currentStep}/{exec.totalSteps}</td>
                  <td className="px-4 py-2 text-gray-300">{exec.startedBy}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(exec.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {executions.length === 0 && <div className="text-center text-gray-500 py-8">No execution history</div>}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Create'} Sequence</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Name</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  <option value="">None</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Description</label>
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" rows={2} />
            </div>
            <div className="flex gap-4 items-center">
              <div>
                <label className="text-sm text-gray-400">Authority Level</label>
                <select value={formAuthLevel} onChange={e => setFormAuthLevel(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  <option value={1}>Operator (1)</option>
                  <option value={2}>Supervisor (2)</option>
                  <option value={3}>Engineer (3)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mt-5 cursor-pointer">
                <input type="checkbox" checked={formEmergency} onChange={e => setFormEmergency(e.target.checked)} className="rounded" />
                <span className="text-sm text-red-400 font-medium">Emergency</span>
              </label>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Steps</h3>
                <button onClick={addStep} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              </div>
              {formSteps.map((step, i) => (
                <div key={i} className="bg-gray-700 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6">#{i + 1}</span>
                    <select value={step.type} onChange={e => updateStep(i, { type: e.target.value })} className="px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                      {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <div className="flex-1" />
                    <button onClick={() => moveStep(i, -1)} className="p-1 text-gray-400 hover:text-white"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveStep(i, 1)} className="p-1 text-gray-400 hover:text-white"><ChevronDown className="w-4 h-4" /></button>
                    <button onClick={() => removeStep(i)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {step.type === 'SET_VALUE' && (
                    <div className="flex gap-2">
                      <select value={step.tagName || ''} onChange={e => updateStep(i, { tagName: e.target.value })} className="flex-1 px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                        <option value="">Select tag...</option>
                        {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                      <input value={step.value || ''} onChange={e => updateStep(i, { value: e.target.value })} placeholder="Value" className="w-24 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                      <select value={step.action || 'set'} onChange={e => updateStep(i, { action: e.target.value })} className="px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                        <option value="set">Set</option><option value="toggle">Toggle</option><option value="increment">Increment</option>
                      </select>
                    </div>
                  )}
                  {step.type === 'CHECK_CONDITION' && (
                    <div className="flex gap-2">
                      <select value={step.condition?.tagName || ''} onChange={e => updateStep(i, { condition: { ...step.condition!, tagName: e.target.value } })} className="flex-1 px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                        <option value="">Select tag...</option>
                        {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                      <select value={step.condition?.operator || 'eq'} onChange={e => updateStep(i, { condition: { ...step.condition!, operator: e.target.value } })} className="px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={step.condition?.value || ''} onChange={e => updateStep(i, { condition: { ...step.condition!, value: e.target.value } })} placeholder="Expected" className="w-24 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                      <input type="number" value={step.timeout || 5} onChange={e => updateStep(i, { timeout: Number(e.target.value) })} placeholder="Timeout(s)" className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                    </div>
                  )}
                  {step.type === 'WAIT' && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input type="number" value={step.value || 1} onChange={e => updateStep(i, { value: e.target.value })} className="w-24 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                      <span className="text-sm text-gray-400">seconds</span>
                    </div>
                  )}
                  {(step.type === 'CONFIRM_OPERATOR' || step.type === 'LOG_EVENT') && (
                    <input value={step.description || ''} onChange={e => updateStep(i, { description: e.target.value })} placeholder={step.type === 'CONFIRM_OPERATOR' ? 'Confirmation message...' : 'Event message...'} className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">Cancel</button>
              <button onClick={save} disabled={!formName} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
