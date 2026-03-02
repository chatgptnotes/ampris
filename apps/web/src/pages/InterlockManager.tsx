import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { Shield, Plus, Edit, Trash2, X, CheckCircle, XCircle, Eye, History } from 'lucide-react';

interface Condition {
  tagName: string;
  operator: string;
  value: string;
  description?: string;
}

interface Interlock {
  id: string;
  name: string;
  description?: string;
  targetTag: string;
  targetAction: string;
  targetValue?: string;
  conditions: Condition[];
  enabled: boolean;
  priority: number;
  bypassable: boolean;
  bypassLevel: number;
  projectId: string;
}

interface InterlockEvent {
  id: string;
  interlockName: string;
  targetTag: string;
  action: string;
  attemptedBy: string;
  conditions: any[];
  bypassed: boolean;
  bypassedBy?: string;
  bypassReason?: string;
  createdAt: string;
}

const OPERATORS = [
  { value: 'eq', label: '=' }, { value: 'ne', label: '!=' },
  { value: 'gt', label: '>' }, { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' }, { value: 'lte', label: '<=' },
];

export default function InterlockManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [interlocks, setInterlocks] = useState<Interlock[]>([]);
  const [events, setEvents] = useState<InterlockEvent[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Interlock | null>(null);
  const [tab, setTab] = useState<'interlocks' | 'status' | 'events'>('interlocks');
  const values = useRealtimeStore(s => s.values);

  // Form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTargetTag, setFormTargetTag] = useState('');
  const [formTargetAction, setFormTargetAction] = useState('ANY');
  const [formTargetValue, setFormTargetValue] = useState('');
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formPriority, setFormPriority] = useState(1);
  const [formBypassable, setFormBypassable] = useState(false);
  const [formBypassLevel, setFormBypassLevel] = useState(3);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [ilRes, evRes, tRes] = await Promise.all([
      api.get('/interlocks', { params: { projectId } }),
      api.get('/interlocks/events', { params: { projectId } }),
      api.get('/tags', { params: { projectId } }),
    ]);
    setInterlocks(ilRes.data);
    setEvents(evRes.data);
    setTags(tRes.data);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormName(''); setFormDesc(''); setFormTargetTag(''); setFormTargetAction('ANY');
    setFormTargetValue(''); setFormConditions([]); setFormEnabled(true);
    setFormPriority(1); setFormBypassable(false); setFormBypassLevel(3);
    setShowModal(true);
  };

  const openEdit = (il: Interlock) => {
    setEditing(il);
    setFormName(il.name); setFormDesc(il.description || ''); setFormTargetTag(il.targetTag);
    setFormTargetAction(il.targetAction); setFormTargetValue(il.targetValue || '');
    setFormConditions(il.conditions || []); setFormEnabled(il.enabled);
    setFormPriority(il.priority); setFormBypassable(il.bypassable); setFormBypassLevel(il.bypassLevel);
    setShowModal(true);
  };

  const save = async () => {
    const payload = {
      name: formName, description: formDesc || undefined, targetTag: formTargetTag,
      targetAction: formTargetAction, targetValue: formTargetValue || undefined,
      conditions: formConditions, enabled: formEnabled, priority: formPriority,
      bypassable: formBypassable, bypassLevel: formBypassLevel, projectId,
    };
    if (editing) await api.put(`/interlocks/${editing.id}`, payload);
    else await api.post('/interlocks', payload);
    setShowModal(false); load();
  };

  const del = async (id: string) => { if (confirm('Delete?')) { await api.delete(`/interlocks/${id}`); load(); } };

  const toggleEnabled = async (il: Interlock) => {
    await api.put(`/interlocks/${il.id}`, { enabled: !il.enabled });
    load();
  };

  const addCondition = () => setFormConditions([...formConditions, { tagName: '', operator: 'eq', value: '', description: '' }]);
  const updateCondition = (i: number, updates: Partial<Condition>) => {
    const next = [...formConditions]; next[i] = { ...next[i], ...updates }; setFormConditions(next);
  };
  const removeCondition = (i: number) => setFormConditions(formConditions.filter((_, idx) => idx !== i));

  const evaluateCondition = (cond: Condition): boolean => {
    const actual = values[cond.tagName];
    if (actual === undefined) return false;
    const numActual = typeof actual === 'number' ? actual : parseFloat(String(actual));
    const numExpected = parseFloat(cond.value);
    switch (cond.operator) {
      case 'eq': return String(actual) === cond.value || numActual === numExpected;
      case 'ne': return String(actual) !== cond.value && numActual !== numExpected;
      case 'gt': return numActual > numExpected;
      case 'lt': return numActual < numExpected;
      case 'gte': return numActual >= numExpected;
      case 'lte': return numActual <= numExpected;
      default: return false;
    }
  };

  const actionBadge = (action: string) => {
    const c = action === 'BLOCKED' ? 'bg-red-600' : action === 'BYPASSED' ? 'bg-yellow-600' : 'bg-green-600';
    return <span className={`px-2 py-0.5 rounded text-xs text-white ${c}`}>{action}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Interlock Manager</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('interlocks')} className={`px-3 py-1.5 rounded text-sm ${tab === 'interlocks' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Interlocks</button>
          <button onClick={() => setTab('status')} className={`px-3 py-1.5 rounded text-sm ${tab === 'status' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Live Status</button>
          <button onClick={() => setTab('events')} className={`px-3 py-1.5 rounded text-sm ${tab === 'events' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Event Log</button>
          <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Interlock
          </button>
        </div>
      </div>

      {tab === 'interlocks' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {interlocks.map(il => (
            <div key={il.id} className={`bg-gray-800 border rounded-lg p-4 space-y-2 ${il.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{il.name}</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={il.enabled} onChange={() => toggleEnabled(il)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-600 peer-checked:bg-green-600 rounded-full peer-focus:ring-2 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div className="text-sm text-gray-400">Target: <span className="text-blue-400">{il.targetTag}</span> ({il.targetAction})</div>
              <div className="text-sm text-gray-400">{il.conditions.length} conditions · Priority {il.priority}</div>
              {il.bypassable && <span className="px-2 py-0.5 rounded text-xs text-yellow-300 bg-yellow-900">Bypassable (L{il.bypassLevel})</span>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(il)} className="p-1 text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                <button onClick={() => del(il.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {interlocks.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No interlocks configured.</div>}
        </div>
      )}

      {tab === 'status' && (
        <div className="space-y-4">
          {interlocks.filter(il => il.enabled).map(il => (
            <div key={il.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">{il.name}</h3>
                <span className="text-sm text-gray-400">Target: {il.targetTag}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">ALL conditions must be TRUE for action to be ALLOWED</div>
              <div className="space-y-1">
                {il.conditions.map((cond, i) => {
                  const passed = evaluateCondition(cond);
                  const actual = values[cond.tagName];
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {passed ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      <span className="text-gray-300">{cond.tagName} {OPERATORS.find(o => o.value === cond.operator)?.label} {cond.value}</span>
                      <span className="text-gray-500">(actual: {actual !== undefined ? String(actual) : 'N/A'})</span>
                      {cond.description && <span className="text-gray-600 text-xs">— {cond.description}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {interlocks.filter(il => il.enabled).length === 0 && <div className="text-center text-gray-500 py-12">No active interlocks</div>}
        </div>
      )}

      {tab === 'events' && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700"><tr>
              <th className="px-4 py-2 text-left text-gray-300">Interlock</th>
              <th className="px-4 py-2 text-left text-gray-300">Tag</th>
              <th className="px-4 py-2 text-left text-gray-300">Action</th>
              <th className="px-4 py-2 text-left text-gray-300">By</th>
              <th className="px-4 py-2 text-left text-gray-300">Time</th>
            </tr></thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-t border-gray-700">
                  <td className="px-4 py-2 text-white">{ev.interlockName}</td>
                  <td className="px-4 py-2 text-gray-300">{ev.targetTag}</td>
                  <td className="px-4 py-2">{actionBadge(ev.action)}</td>
                  <td className="px-4 py-2 text-gray-300">{ev.attemptedBy}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(ev.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <div className="text-center text-gray-500 py-8">No interlock events</div>}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Create'} Interlock</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-gray-400">Name</label><input value={formName} onChange={e => setFormName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
              <div><label className="text-sm text-gray-400">Target Tag</label>
                <select value={formTargetTag} onChange={e => setFormTargetTag(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  <option value="">Select tag...</option>
                  {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-sm text-gray-400">Target Action</label>
                <select value={formTargetAction} onChange={e => setFormTargetAction(e.target.value)} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  <option value="ANY">ANY</option><option value="SET">SET</option><option value="TOGGLE">TOGGLE</option>
                </select>
              </div>
              <div><label className="text-sm text-gray-400">Target Value (opt)</label><input value={formTargetValue} onChange={e => setFormTargetValue(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
              <div><label className="text-sm text-gray-400">Priority</label><input type="number" value={formPriority} onChange={e => setFormPriority(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
            </div>
            <div><label className="text-sm text-gray-400">Description</label><textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" rows={2} /></div>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formEnabled} onChange={e => setFormEnabled(e.target.checked)} className="rounded" /><span className="text-sm text-gray-300">Enabled</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formBypassable} onChange={e => setFormBypassable(e.target.checked)} className="rounded" /><span className="text-sm text-gray-300">Bypassable</span></label>
              {formBypassable && (
                <div><label className="text-sm text-gray-400">Bypass Level</label>
                  <select value={formBypassLevel} onChange={e => setFormBypassLevel(Number(e.target.value))} className="ml-2 px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                    <option value={2}>Supervisor (2)</option><option value={3}>Engineer (3)</option><option value={4}>Admin (4)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-gray-300">Conditions</h3><p className="text-xs text-gray-500">ALL must be TRUE for action to be ALLOWED</p></div>
                <button onClick={addCondition} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs"><Plus className="w-3 h-3" /> Add</button>
              </div>
              {formConditions.map((cond, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={cond.tagName} onChange={e => updateCondition(i, { tagName: e.target.value })} className="flex-1 px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                    <option value="">Tag...</option>
                    {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <select value={cond.operator} onChange={e => updateCondition(i, { operator: e.target.value })} className="px-2 py-1 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })} placeholder="Value" className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                  <input value={cond.description || ''} onChange={e => updateCondition(i, { description: e.target.value })} placeholder="Desc" className="w-32 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm" />
                  <button onClick={() => removeCondition(i)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">Cancel</button>
              <button onClick={save} disabled={!formName || !formTargetTag} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
