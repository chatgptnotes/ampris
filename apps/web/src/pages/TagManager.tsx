import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import {
  Plus, Search, Trash2, Pencil, Download, Upload, Filter, X, Tag as TagIcon, Activity, Calculator, Wifi, ChevronDown,
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
  initialValue?: string;
  currentValue?: string;
  simPattern?: string | null;
  simFrequency?: number | null;
  simAmplitude?: number | null;
  simOffset?: number | null;
  formula?: string | null;
  group?: string | null;
  liveValue?: any;
  liveTimestamp?: string;
}

const TAG_TYPES = ['INTERNAL', 'SIMULATED', 'CALCULATED', 'EXTERNAL'] as const;
const DATA_TYPES = ['BOOLEAN', 'INTEGER', 'FLOAT', 'STRING'] as const;
const SIM_PATTERNS = ['sine', 'random', 'ramp', 'square'] as const;
const UNITS = ['kV', 'V', 'MW', 'kW', 'W', 'A', 'mA', 'Hz', '°C', '°F', 'bar', 'psi', '%', 'RPM', 'L/s', 'm³/h', 'Ω', 'PF', 'MVAr', 'kVAr', ''];

const TYPE_ICONS: Record<string, React.ElementType> = {
  INTERNAL: TagIcon,
  SIMULATED: Activity,
  CALCULATED: Calculator,
  EXTERNAL: Wifi,
};

const TYPE_COLORS: Record<string, string> = {
  INTERNAL: 'bg-blue-100 text-blue-700',
  SIMULATED: 'bg-purple-100 text-purple-700',
  CALCULATED: 'bg-amber-100 text-amber-700',
  EXTERNAL: 'bg-green-100 text-green-700',
};

function getValueColor(tag: TagData): string {
  if (tag.liveValue === undefined || tag.liveValue === null) return 'text-gray-400';
  if (tag.minValue != null && tag.maxValue != null && typeof tag.liveValue === 'number') {
    const range = tag.maxValue - tag.minValue;
    const pct = (tag.liveValue - tag.minValue) / range;
    if (pct > 0.9 || pct < 0.1) return 'text-red-600 font-semibold';
    if (pct > 0.8 || pct < 0.2) return 'text-amber-600';
  }
  return 'text-green-600';
}

const emptyTag: Omit<TagData, 'id' | 'liveValue' | 'liveTimestamp' | 'currentValue'> = {
  name: '', description: '', type: 'INTERNAL', dataType: 'FLOAT', unit: '', minValue: null, maxValue: null,
  initialValue: '0', simPattern: null, simFrequency: null, simAmplitude: null, simOffset: null, formula: null, group: null,
};

export default function TagManager() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [form, setForm] = useState(emptyTag);
  const [saving, setSaving] = useState(false);
  const refreshTimer = useRef<NodeJS.Timeout>();

  const loadTags = useCallback(async () => {
    try {
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterGroup) params.group = filterGroup;
      if (search) params.search = search;
      const { data } = await api.get('/tags', { params });
      setTags(data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterGroup, search]);

  useEffect(() => {
    loadTags();
    refreshTimer.current = setInterval(loadTags, 2000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [loadTags]);

  const groups = [...new Set(tags.map((t) => t.group).filter(Boolean))] as string[];

  const openCreate = () => {
    setEditingTag(null);
    setForm(emptyTag);
    setShowModal(true);
  };

  const openEdit = (tag: TagData) => {
    setEditingTag(tag);
    setForm({
      name: tag.name, description: tag.description || '', type: tag.type, dataType: tag.dataType,
      unit: tag.unit || '', minValue: tag.minValue ?? null, maxValue: tag.maxValue ?? null,
      initialValue: tag.initialValue || '0',
      simPattern: tag.simPattern || null, simFrequency: tag.simFrequency ?? null,
      simAmplitude: tag.simAmplitude ?? null, simOffset: tag.simOffset ?? null,
      formula: tag.formula || null, group: tag.group || null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        minValue: form.minValue === null ? null : Number(form.minValue),
        maxValue: form.maxValue === null ? null : Number(form.maxValue),
        simFrequency: form.simFrequency === null ? null : Number(form.simFrequency),
        simAmplitude: form.simAmplitude === null ? null : Number(form.simAmplitude),
        simOffset: form.simOffset === null ? null : Number(form.simOffset),
      };
      if (editingTag) {
        await api.put(`/tags/${editingTag.id}`, payload);
      } else {
        await api.post('/tags', payload);
      }
      setShowModal(false);
      loadTags();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagData) => {
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    try {
      await api.delete(`/tags/${tag.id}`);
      loadTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const exportTags = () => {
    const json = JSON.stringify(tags.map(({ id, liveValue, liveTimestamp, ...rest }) => rest), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gridvision-tags.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTags = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) { alert('Invalid file format'); return; }
      let count = 0;
      for (const tag of imported) {
        try {
          await api.post('/tags', tag);
          count++;
        } catch { /* skip duplicates */ }
      }
      alert(`Imported ${count} tags`);
      loadTags();
    } catch {
      alert('Failed to parse file');
    }
    e.target.value = '';
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tag Manager</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tags.length} tags configured</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportTags} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              <Upload className="w-4 h-4" /> Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={importTags} className="hidden" />
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Tag
            </button>
          </div>
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
            placeholder="Search tags..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-700 bg-white"
          >
            <option value="">All Types</option>
            {TAG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {groups.length > 0 && (
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-700 bg-white"
            >
              <option value="">All Groups</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading tags...</div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400">
            <TagIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No tags configured</p>
            <p className="text-sm mt-1">Create your first tag to get started</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Create Tag
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Group</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Live Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Range</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  const Icon = TYPE_ICONS[tag.type] || TagIcon;
                  return (
                    <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{tag.name}</div>
                        {tag.description && <div className="text-xs text-gray-400 mt-0.5">{tag.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tag.type] || 'bg-gray-100 text-gray-600'}`}>
                          <Icon className="w-3 h-3" /> {tag.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{tag.dataType}</td>
                      <td className="px-4 py-3 text-gray-500">{tag.group || '—'}</td>
                      <td className={`px-4 py-3 text-right font-mono ${getValueColor(tag)}`}>
                        {tag.liveValue !== undefined && tag.liveValue !== null
                          ? typeof tag.liveValue === 'boolean'
                            ? tag.liveValue ? 'TRUE' : 'FALSE'
                            : typeof tag.liveValue === 'number'
                              ? tag.liveValue.toFixed(tag.dataType === 'INTEGER' ? 0 : 2)
                              : String(tag.liveValue)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{tag.unit || ''}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {tag.minValue != null && tag.maxValue != null ? `${tag.minValue} – ${tag.maxValue}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(tag)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(tag)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">{editingTag ? 'Edit Tag' : 'Create New Tag'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Name + Group row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. MANUAL.voltage_test"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <input
                    type="text"
                    value={form.group || ''}
                    onChange={(e) => setForm({ ...form, group: e.target.value || null })}
                    placeholder="e.g. Power, Alarms"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Type + Data Type + Unit */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {TAG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Type *</label>
                  <select
                    value={form.dataType}
                    onChange={(e) => setForm({ ...form, dataType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.unit || ''}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u || '(none)'}</option>)}
                  </select>
                </div>
              </div>

              {/* Min/Max/Initial */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                  <input
                    type="number"
                    value={form.minValue ?? ''}
                    onChange={(e) => setForm({ ...form, minValue: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                  <input
                    type="number"
                    value={form.maxValue ?? ''}
                    onChange={(e) => setForm({ ...form, maxValue: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Value</label>
                  <input
                    type="text"
                    value={form.initialValue || ''}
                    onChange={(e) => setForm({ ...form, initialValue: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Simulation settings */}
              {form.type === 'SIMULATED' && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-purple-700">Simulation Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Pattern</label>
                      <select
                        value={form.simPattern || 'sine'}
                        onChange={(e) => setForm({ ...form, simPattern: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-700 bg-white"
                      >
                        {SIM_PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Frequency (Hz)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.simFrequency ?? 1}
                        onChange={(e) => setForm({ ...form, simFrequency: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Amplitude</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.simAmplitude ?? 1}
                        onChange={(e) => setForm({ ...form, simAmplitude: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-600 mb-1">Offset</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.simOffset ?? 0}
                        onChange={(e) => setForm({ ...form, simOffset: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg text-gray-700 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Calculated formula */}
              {form.type === 'CALCULATED' && (
                <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-amber-700">Calculation Formula</h3>
                  <p className="text-xs text-amber-600">Use tag names in expressions. E.g.: <code>tag1 + tag2 * 0.5</code></p>
                  <textarea
                    value={form.formula || ''}
                    onChange={(e) => setForm({ ...form, formula: e.target.value })}
                    rows={3}
                    placeholder="e.g. MANUAL.voltage_bus1 + MANUAL.voltage_bus2 * 0.5"
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg text-gray-700 bg-white font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}
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
                {saving ? 'Saving...' : editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
