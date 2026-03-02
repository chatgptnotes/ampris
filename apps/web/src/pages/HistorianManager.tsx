import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Database, Settings, Trash2, X, Search, BarChart3, Download, Check } from 'lucide-react';

interface HistorianConfig {
  id: string;
  tagName: string;
  enabled: boolean;
  compressionType: string;
  deadband: number | null;
  deadbandPercent: number | null;
  slopeThreshold: number | null;
  maxInterval: number;
  minInterval: number;
  retentionDays: number;
  projectId: string;
}

interface HistorianStat {
  tagName: string;
  totalRawPoints: number;
  totalStored: number;
  compressionRatio: number;
  compressionType: string;
}

interface HistoryPoint {
  id: string;
  tagName: string;
  value: number;
  timestamp: string;
  quality: string;
}

const PRESETS = {
  'High Resolution': { compressionType: 'none', deadband: null, deadbandPercent: null, slopeThreshold: null, retentionDays: 30, maxInterval: 3600, minInterval: 0 },
  'Standard': { compressionType: 'deadband', deadband: null, deadbandPercent: 1, slopeThreshold: null, retentionDays: 365, maxInterval: 3600, minInterval: 1 },
  'Low Storage': { compressionType: 'swinging_door', deadband: null, deadbandPercent: null, slopeThreshold: 0.5, retentionDays: 1825, maxInterval: 7200, minInterval: 5 },
};

export default function HistorianManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const [configs, setConfigs] = useState<HistorianConfig[]>([]);
  const [stats, setStats] = useState<HistorianStat[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [editConfig, setEditConfig] = useState<Partial<HistorianConfig> | null>(null);
  const [queryTag, setQueryTag] = useState('');
  const [queryFrom, setQueryFrom] = useState('');
  const [queryTo, setQueryTo] = useState('');
  const [queryData, setQueryData] = useState<HistoryPoint[]>([]);
  const [showQuery, setShowQuery] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [cfgRes, statsRes, storageRes, tagsRes] = await Promise.all([
        api.get('/historian-compression/configs', { params: { projectId } }),
        api.get('/historian-compression/stats', { params: { projectId } }),
        api.get('/historian-compression/storage', { params: { projectId } }),
        api.get('/tags', { params: { projectId } }),
      ]);
      setConfigs(cfgRes.data);
      setStats(statsRes.data);
      setStorage(storageRes.data);
      setTags(tagsRes.data.map((t: any) => t.name));
    } catch {}
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async () => {
    if (!editConfig || !projectId) return;
    try {
      if (editConfig.id) {
        await api.put(`/historian-compression/configs/${editConfig.id}`, editConfig);
      } else {
        await api.post('/historian-compression/configs', { ...editConfig, projectId });
      }
      setEditConfig(null);
      fetchData();
    } catch {}
  };

  const deleteConfig = async (id: string) => {
    try {
      await api.delete(`/historian-compression/configs/${id}`);
      fetchData();
    } catch {}
  };

  const applyPreset = async (presetName: keyof typeof PRESETS) => {
    if (selectedTags.size === 0) return;
    const preset = PRESETS[presetName];
    for (const tagName of selectedTags) {
      try {
        await api.post('/historian-compression/configs', { ...preset, tagName, projectId, enabled: true });
      } catch {}
    }
    setSelectedTags(new Set());
    fetchData();
  };

  const runQuery = async () => {
    if (!queryTag) return;
    try {
      const params: any = { tag: queryTag, maxPoints: 1000 };
      if (queryFrom) params.from = new Date(queryFrom).toISOString();
      if (queryTo) params.to = new Date(queryTo).toISOString();
      const res = await api.get('/historian-compression/query', { params });
      setQueryData(res.data);
    } catch {}
  };

  const cleanup = async () => {
    if (!projectId) return;
    try {
      await api.post('/historian-compression/cleanup', { projectId });
      fetchData();
    } catch {}
  };

  const filteredConfigs = configs.filter((c) => c.tagName.toLowerCase().includes(search.toLowerCase()));
  const configMap = new Map(configs.map((c) => [c.tagName, c]));
  const statMap = new Map(stats.map((s) => [s.tagName, s]));

  const toggleTag = (tagName: string) => {
    const next = new Set(selectedTags);
    next.has(tagName) ? next.delete(tagName) : next.add(tagName);
    setSelectedTags(next);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Historian Manager</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQuery(!showQuery)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Query
          </button>
          <button onClick={cleanup} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Cleanup
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      {storage && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-gray-400 text-xs">Total Points</div>
            <div className="text-white text-xl font-bold">{storage.totalPoints?.toLocaleString()}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-gray-400 text-xs">Storage</div>
            <div className="text-white text-xl font-bold">{storage.estimatedSizeMB} MB</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-gray-400 text-xs">Tags Tracked</div>
            <div className="text-white text-xl font-bold">{configs.length}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-gray-400 text-xs">Avg Compression</div>
            <div className="text-green-400 text-xl font-bold">
              {stats.length > 0 ? `${Math.round(stats.reduce((s, x) => s + x.compressionRatio, 0) / stats.length)}%` : '0%'} reduction
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedTags.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 flex items-center gap-3">
          <span className="text-blue-300 text-sm">{selectedTags.size} tags selected</span>
          {Object.keys(PRESETS).map((name) => (
            <button key={name} onClick={() => applyPreset(name as keyof typeof PRESETS)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">
              {name}
            </button>
          ))}
          <button onClick={() => setSelectedTags(new Set())} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        />
      </div>

      {/* Tag List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-gray-400 text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" onChange={(e) => {
                  if (e.target.checked) setSelectedTags(new Set(tags));
                  else setSelectedTags(new Set());
                }} className="rounded" />
              </th>
              <th className="px-4 py-3 text-left">Tag</th>
              <th className="px-4 py-3 text-left">Compression</th>
              <th className="px-4 py-3 text-left">Deadband</th>
              <th className="px-4 py-3 text-left">Retention</th>
              <th className="px-4 py-3 text-left">Raw</th>
              <th className="px-4 py-3 text-left">Stored</th>
              <th className="px-4 py-3 text-left">Ratio</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.filter((t) => t.toLowerCase().includes(search.toLowerCase())).map((tagName) => {
              const cfg = configMap.get(tagName);
              const st = statMap.get(tagName);
              return (
                <tr key={tagName} className="border-t border-gray-700/50 hover:bg-gray-700/20">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selectedTags.has(tagName)} onChange={() => toggleTag(tagName)} className="rounded" />
                  </td>
                  <td className="px-4 py-2 text-white font-mono text-xs">{tagName}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${cfg ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {cfg?.compressionType || 'unconfigured'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {cfg?.deadband || cfg?.deadbandPercent ? `${cfg.deadbandPercent ? cfg.deadbandPercent + '%' : cfg.deadband}` : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{cfg?.retentionDays ? `${cfg.retentionDays}d` : '-'}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{st?.totalRawPoints || 0}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{st?.totalStored || 0}</td>
                  <td className="px-4 py-2 text-xs">
                    {st?.compressionRatio != null ? (
                      <span className="text-green-400">{st.compressionRatio}%</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => setEditConfig(cfg || { tagName, enabled: true, compressionType: 'none', maxInterval: 3600, minInterval: 0, retentionDays: 365 })} className="text-blue-400 hover:text-blue-300 text-xs mr-2">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    {cfg && (
                      <button onClick={() => deleteConfig(cfg.id)} className="text-red-400 hover:text-red-300 text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditConfig(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-[480px] max-h-[80vh] overflow-y-auto border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Configure: {editConfig.tagName}</h3>
              <button onClick={() => setEditConfig(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Compression Type</label>
                <select value={editConfig.compressionType || 'none'} onChange={(e) => setEditConfig({ ...editConfig, compressionType: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded text-sm">
                  <option value="none">None (store all)</option>
                  <option value="deadband">Deadband</option>
                  <option value="swinging_door">Swinging Door</option>
                </select>
              </div>
              {editConfig.compressionType === 'deadband' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Absolute Deadband</label>
                    <input type="number" step="0.1" value={editConfig.deadband ?? ''} onChange={(e) => setEditConfig({ ...editConfig, deadband: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Deadband % (of value)</label>
                    <input type="number" step="0.1" value={editConfig.deadbandPercent ?? ''} onChange={(e) => setEditConfig({ ...editConfig, deadbandPercent: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
                  </div>
                </>
              )}
              {editConfig.compressionType === 'swinging_door' && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Slope Threshold</label>
                  <input type="number" step="0.01" value={editConfig.slopeThreshold ?? ''} onChange={(e) => setEditConfig({ ...editConfig, slopeThreshold: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max Interval (s)</label>
                  <input type="number" value={editConfig.maxInterval ?? 3600} onChange={(e) => setEditConfig({ ...editConfig, maxInterval: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Min Interval (s)</label>
                  <input type="number" value={editConfig.minInterval ?? 0} onChange={(e) => setEditConfig({ ...editConfig, minInterval: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Retention (days)</label>
                <input type="number" value={editConfig.retentionDays ?? 365} onChange={(e) => setEditConfig({ ...editConfig, retentionDays: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                {Object.entries(PRESETS).map(([name, preset]) => (
                  <button key={name} onClick={() => setEditConfig({ ...editConfig, ...preset })} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">
                    {name}
                  </button>
                ))}
              </div>
              <button onClick={saveConfig} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Query Panel */}
      {showQuery && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
          <h3 className="text-white font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Historical Query</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={queryTag} onChange={(e) => setQueryTag(e.target.value)} className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded text-sm">
              <option value="">Select tag...</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="datetime-local" value={queryFrom} onChange={(e) => setQueryFrom(e.target.value)} className="px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" placeholder="From" />
            <input type="datetime-local" value={queryTo} onChange={(e) => setQueryTo(e.target.value)} className="px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm" placeholder="To" />
            <button onClick={runQuery} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm">Query</button>
          </div>
          {queryData.length > 0 && (
            <>
              {/* Simple line chart using SVG */}
              <div className="bg-gray-900 rounded-lg p-4 h-48">
                <svg viewBox="0 0 800 150" className="w-full h-full">
                  {(() => {
                    const values = queryData.map((d) => d.value);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const range = max - min || 1;
                    const points = queryData.map((d, i) => {
                      const x = (i / Math.max(queryData.length - 1, 1)) * 780 + 10;
                      const y = 140 - ((d.value - min) / range) * 130;
                      return `${x},${y}`;
                    }).join(' ');
                    return <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="1.5" />;
                  })()}
                </svg>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-400 bg-gray-900/50 sticky top-0">
                    <tr><th className="px-3 py-2 text-left">Timestamp</th><th className="px-3 py-2 text-left">Value</th><th className="px-3 py-2 text-left">Quality</th></tr>
                  </thead>
                  <tbody>
                    {queryData.map((d) => (
                      <tr key={d.id} className="border-t border-gray-700/30">
                        <td className="px-3 py-1 text-gray-400">{new Date(d.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-1 text-white">{d.value}</td>
                        <td className="px-3 py-1 text-green-400">{d.quality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
