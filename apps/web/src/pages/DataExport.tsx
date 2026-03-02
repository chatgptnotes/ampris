import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Download, Tag, Clock, Bell, Shield, Eye, X } from 'lucide-react';

type ExportTab = 'tags' | 'history' | 'alarms' | 'audit';

export default function DataExport() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<ExportTab>('tags');
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 16);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [format, setFormat] = useState('csv');
  const [preview, setPreview] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) api.get('/tags', { params: { projectId } }).then(({ data }) => setTags(data)).catch(() => {});
  }, [projectId]);

  const toggleTag = (name: string) => {
    setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  };

  const getExportUrl = (): { url: string; params: Record<string, string> } => {
    const params: Record<string, string> = { format };
    if (projectId) params.projectId = projectId;
    switch (tab) {
      case 'tags': return { url: '/export/tags', params };
      case 'history':
        if (selectedTags.length) params.tags = selectedTags.join(',');
        params.from = new Date(dateFrom).toISOString();
        params.to = new Date(dateTo).toISOString();
        return { url: '/export/tag-history', params };
      case 'alarms':
        params.from = new Date(dateFrom).toISOString();
        params.to = new Date(dateTo).toISOString();
        return { url: '/export/alarms', params };
      case 'audit':
        params.from = new Date(dateFrom).toISOString();
        params.to = new Date(dateTo).toISOString();
        return { url: '/export/audit', params };
    }
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const { url, params } = getExportUrl();
      const { data } = await api.get(url, { params: { ...params, format: 'json' } });
      const arr = Array.isArray(data) ? data : [];
      setPreview(arr.slice(0, 20));
    } catch (err) { setPreview([]); }
    finally { setLoading(false); }
  };

  const doDownload = async () => {
    try {
      const { url, params } = getExportUrl();
      const { data } = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = `${tab}-export.${format === 'json' ? 'json' : 'csv'}`; a.click();
      URL.revokeObjectURL(blobUrl);
    } catch { alert('Download failed'); }
  };

  const tabs: { key: ExportTab; label: string; icon: React.ElementType }[] = [
    { key: 'tags', label: 'Tags', icon: Tag },
    { key: 'history', label: 'Tag History', icon: Clock },
    { key: 'alarms', label: 'Alarms', icon: Bell },
    { key: 'audit', label: 'Audit Log', icon: Shield },
  ];

  const needsDateRange = tab !== 'tags';
  const needsTagSelect = tab === 'history';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">Data Export</h1>
        <p className="text-sm text-gray-500 mt-0.5">Export tags, history, alarms, and audit data</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {needsDateRange && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
          )}

          {needsTagSelect && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Tags ({selectedTags.length})</label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {tags.map(t => (
                  <label key={t.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={selectedTags.includes(t.name)} onChange={() => toggleTag(t.name)} className="rounded" />
                    <span className="text-sm text-gray-700">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div className="flex items-end gap-2 mt-auto pt-6">
              <button onClick={fetchPreview} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                <Eye className="w-4 h-4" /> {loading ? 'Loading...' : 'Preview'}
              </button>
              <button onClick={doDownload}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>
        </div>

        {/* Preview table */}
        {preview && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">Preview (first 20 rows)</h3>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            {preview.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No data found for the selected criteria</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {Object.keys(preview[0]).map(k => (
                      <th key={k} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
