import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Plus, Play, Square, Trash2, Pencil, X, GripVertical, BookOpen, Clock, CheckCircle } from 'lucide-react';

interface RecipeStep {
  tagName: string;
  value: string | number | boolean;
  delay: number;
  order: number;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: RecipeStep[];
  isActive: boolean;
  lastRunAt?: string;
  _status?: string;
  _currentStep?: number;
}

interface TagOption {
  id: string;
  name: string;
}

export default function RecipeManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [steps, setSteps] = useState<RecipeStep[]>([]);

  const loadRecipes = useCallback(async () => {
    try {
      const { data } = await api.get('/recipes', { params: { projectId } });
      setRecipes(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);
  useEffect(() => {
    if (projectId) api.get('/tags', { params: { projectId } }).then(({ data }) => setTags(data)).catch(() => {});
  }, [projectId]);

  // Poll status for running recipes
  useEffect(() => {
    const running = recipes.filter(r => r._status === 'running');
    if (running.length === 0) return;
    const interval = setInterval(loadRecipes, 2000);
    return () => clearInterval(interval);
  }, [recipes, loadRecipes]);

  const openCreate = () => {
    setEditing(null); setName(''); setDescription(''); setCategory('');
    setSteps([{ tagName: '', value: '', delay: 0, order: 0 }]);
    setShowModal(true);
  };

  const openEdit = (r: Recipe) => {
    setEditing(r); setName(r.name); setDescription(r.description || ''); setCategory(r.category || '');
    setSteps(r.steps.length > 0 ? r.steps : [{ tagName: '', value: '', delay: 0, order: 0 }]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!projectId || !name) return;
    setSaving(true);
    try {
      const payload = { name, description, category, steps: steps.map((s, i) => ({ ...s, order: i })), projectId };
      if (editing) { await api.put(`/recipes/${editing.id}`, payload); }
      else { await api.post('/recipes', payload); }
      setShowModal(false);
      loadRecipes();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r: Recipe) => {
    if (!confirm(`Delete recipe "${r.name}"?`)) return;
    await api.delete(`/recipes/${r.id}`).catch(() => {});
    loadRecipes();
  };

  const handleExecute = async (r: Recipe) => {
    if (!confirm(`Execute recipe "${r.name}"? This will set tag values.`)) return;
    try {
      await api.post(`/recipes/${r.id}/execute`);
      loadRecipes();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to execute'); }
  };

  const handleStop = async (r: Recipe) => {
    await api.post(`/recipes/${r.id}/stop`).catch(() => {});
    loadRecipes();
  };

  const addStep = () => setSteps([...steps, { tagName: '', value: '', delay: 1, order: steps.length }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, val: any) => {
    const s = [...steps]; (s[i] as any)[field] = val; setSteps(s);
  };
  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const s = [...steps]; [s[from], s[to]] = [s[to], s[from]]; setSteps(s);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Recipe Manager</h1>
            <p className="text-sm text-gray-500 mt-0.5">{recipes.length} recipes configured</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Recipe
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400">
            <BookOpen className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No recipes yet</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Create Recipe
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map(r => {
              const isRunning = r._status === 'running';
              const progress = isRunning && r.steps.length > 0 ? ((r._currentStep || 0) / r.steps.length) * 100 : 0;
              return (
                <div key={r.id} className={`bg-white rounded-xl border p-5 ${isRunning ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{r.name}</h3>
                      {r.category && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{r.category}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {r.description && <p className="text-sm text-gray-500 mb-3">{r.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span>{r.steps.length} steps</span>
                    {r.lastRunAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.lastRunAt).toLocaleString()}</span>}
                  </div>

                  {isRunning && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-green-700 mb-1">
                        <span>Running step {r._currentStep}/{r.steps.length}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {r._status === 'completed' && (
                    <div className="flex items-center gap-1 text-xs text-green-600 mb-3">
                      <CheckCircle className="w-3.5 h-3.5" /> Completed
                    </div>
                  )}

                  <div className="flex gap-2">
                    {isRunning ? (
                      <button onClick={() => handleStop(r)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                        <Square className="w-4 h-4" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => handleExecute(r)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <Play className="w-4 h-4" /> Execute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Recipe' : 'Create Recipe'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Startup, Shutdown" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Steps</label>
                  <button onClick={addStep} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Step</button>
                </div>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveStep(i, i - 1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><GripVertical className="w-4 h-4" /></button>
                      </div>
                      <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                      <select
                        value={step.tagName}
                        onChange={e => updateStep(i, 'tagName', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                      >
                        <option value="">Select tag...</option>
                        {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                      <input
                        value={String(step.value)}
                        onChange={e => updateStep(i, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={step.delay}
                          onChange={e => updateStep(i, 'delay', Number(e.target.value))}
                          className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                        />
                        <span className="text-xs text-gray-400">s</span>
                      </div>
                      <button onClick={() => removeStep(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
