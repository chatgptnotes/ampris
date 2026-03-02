import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { MousePointerClick, Plus, Edit, Trash2, X, User, Clock } from 'lucide-react';

interface SBOConfig {
  id: string;
  tagName: string;
  enabled: boolean;
  selectTimeout: number;
  confirmRequired: boolean;
  authorityLevel: number;
  projectId: string;
}

interface SBOSelection {
  tagName: string;
  selectedBy: string;
  selectedAt: string;
  pendingValue: any;
}

export default function SBOManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [configs, setConfigs] = useState<SBOConfig[]>([]);
  const [selections, setSelections] = useState<SBOSelection[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SBOConfig | null>(null);

  const [formTagName, setFormTagName] = useState('');
  const [formTimeout, setFormTimeout] = useState(30);
  const [formConfirm, setFormConfirm] = useState(true);
  const [formAuthLevel, setFormAuthLevel] = useState(1);
  const [formEnabled, setFormEnabled] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [cRes, sRes, tRes] = await Promise.all([
      api.get('/sbo/configs', { params: { projectId } }),
      api.get('/sbo/status'),
      api.get('/tags', { params: { projectId } }),
    ]);
    setConfigs(cRes.data);
    setSelections(sRes.data);
    setTags(tRes.data);
  }, [projectId]);

  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [load]);

  const openCreate = () => {
    setEditing(null); setFormTagName(''); setFormTimeout(30); setFormConfirm(true); setFormAuthLevel(1); setFormEnabled(true);
    setShowModal(true);
  };

  const openEdit = (c: SBOConfig) => {
    setEditing(c); setFormTagName(c.tagName); setFormTimeout(c.selectTimeout); setFormConfirm(c.confirmRequired); setFormAuthLevel(c.authorityLevel); setFormEnabled(c.enabled);
    setShowModal(true);
  };

  const save = async () => {
    const payload = { tagName: formTagName, selectTimeout: formTimeout, confirmRequired: formConfirm, authorityLevel: formAuthLevel, enabled: formEnabled, projectId };
    if (editing) await api.put(`/sbo/configs/${editing.id}`, payload);
    else await api.post('/sbo/configs', payload);
    setShowModal(false); load();
  };

  const del = async (id: string) => { if (confirm('Remove SBO config?')) { await api.delete(`/sbo/configs/${id}`); load(); } };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MousePointerClick className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Select-Before-Operate</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Configure Tag
        </button>
      </div>

      {/* Current Selections */}
      {selections.length > 0 && (
        <div className="bg-gray-800 border border-yellow-500 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-400 mb-3">Active Selections</h3>
          <div className="space-y-2">
            {selections.map(s => (
              <div key={s.tagName} className="flex items-center justify-between bg-gray-700 rounded p-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-white font-medium">{s.tagName}</span>
                  <span className="text-gray-400 text-sm">→ {String(s.pendingValue)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <User className="w-4 h-4" /> {s.selectedBy}
                  <Clock className="w-4 h-4 ml-2" /> {new Date(s.selectedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configs.map(c => (
          <div key={c.id} className={`bg-gray-800 border rounded-lg p-4 space-y-2 ${c.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{c.tagName}</h3>
              <span className={`px-2 py-0.5 rounded text-xs ${c.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{c.enabled ? 'Active' : 'Disabled'}</span>
            </div>
            <div className="text-sm text-gray-400">Timeout: {c.selectTimeout}s · Level {c.authorityLevel}</div>
            <div className="text-sm text-gray-400">{c.confirmRequired ? 'Confirmation required' : 'No confirmation'}</div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
              <button onClick={() => del(c.id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {configs.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No SBO configurations. Add tags that require Select-Before-Operate.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Add'} SBO Config</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-sm text-gray-400">Tag</label>
              <select value={formTagName} onChange={e => setFormTagName(e.target.value)} disabled={!!editing} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                <option value="">Select tag...</option>
                {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-gray-400">Timeout (s)</label><input type="number" value={formTimeout} onChange={e => setFormTimeout(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
              <div><label className="text-sm text-gray-400">Authority Level</label>
                <select value={formAuthLevel} onChange={e => setFormAuthLevel(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-white text-gray-900 border border-gray-600 rounded text-sm">
                  <option value={1}>Operator (1)</option><option value={2}>Supervisor (2)</option><option value={3}>Engineer (3)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formEnabled} onChange={e => setFormEnabled(e.target.checked)} className="rounded" /><span className="text-sm text-gray-300">Enabled</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formConfirm} onChange={e => setFormConfirm(e.target.checked)} className="rounded" /><span className="text-sm text-gray-300">Require Confirmation</span></label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">Cancel</button>
              <button onClick={save} disabled={!formTagName} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
