import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Plus, FileText, Download, Trash2, Pencil, X, Eye, Play, Clock } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  schedule?: string;
  config: { tags: string[]; timeRange?: string; aggregation?: string; groupBy?: string; columns?: string[] };
  lastGeneratedAt?: string;
}

interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  format: string;
  createdAt: string;
}

const REPORT_TYPES = ['SHIFT_REPORT', 'DAILY_GENERATION', 'EVENT_LOG', 'CUSTOM'];
const TIME_RANGES = ['1h', '8h', '24h', '7d'];
const AGGREGATIONS = ['None', 'Average', 'Min', 'Max', 'Sum', 'Count'];
const GROUP_BYS = ['None', 'Hour', 'Shift', 'Day'];

const TYPE_COLORS: Record<string, string> = {
  SHIFT_REPORT: 'bg-blue-100 text-blue-700',
  DAILY_GENERATION: 'bg-green-100 text-green-700',
  EVENT_LOG: 'bg-amber-100 text-amber-700',
  CUSTOM: 'bg-purple-100 text-purple-700',
};

export default function ReportBuilder() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<'templates' | 'generated'>('templates');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [generated, setGenerated] = useState<GeneratedReport[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ReportTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('CUSTOM');
  const [formSchedule, setFormSchedule] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTimeRange, setFormTimeRange] = useState('24h');
  const [formAggregation, setFormAggregation] = useState('None');
  const [formGroupBy, setFormGroupBy] = useState('None');

  const load = useCallback(async () => {
    try {
      const [t, g, tg] = await Promise.all([
        api.get('/report-templates', { params: { projectId } }),
        api.get('/report-templates/generated', { params: { projectId } }),
        api.get('/tags', { params: { projectId } }),
      ]);
      setTemplates(t.data);
      setGenerated(g.data);
      setTags(tg.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormDesc(''); setFormType('CUSTOM'); setFormSchedule('');
    setFormTags([]); setFormTimeRange('24h'); setFormAggregation('None'); setFormGroupBy('None');
    setPreviewData(null); setShowModal(true);
  };

  const openEdit = (t: ReportTemplate) => {
    setEditing(t); setFormName(t.name); setFormDesc(t.description || ''); setFormType(t.type);
    setFormSchedule(t.schedule || ''); setFormTags(t.config.tags || []);
    setFormTimeRange(t.config.timeRange || '24h'); setFormAggregation(t.config.aggregation || 'None');
    setFormGroupBy(t.config.groupBy || 'None'); setPreviewData(null); setShowModal(true);
  };

  const handleSave = async () => {
    if (!projectId || !formName) return;
    setSaving(true);
    try {
      const payload = {
        name: formName, description: formDesc, type: formType, schedule: formSchedule || null,
        config: { tags: formTags, timeRange: formTimeRange, aggregation: formAggregation, groupBy: formGroupBy },
        projectId,
      };
      if (editing) await api.put(`/report-templates/${editing.id}`, payload);
      else await api.post('/report-templates', payload);
      setShowModal(false); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: ReportTemplate) => {
    if (!confirm(`Delete "${t.name}"?`)) return;
    await api.delete(`/report-templates/${t.id}`).catch(() => {});
    load();
  };

  const handleGenerate = async (t: ReportTemplate) => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/report-templates/${t.id}/generate`);
      setPreviewData(data.data);
      load();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to generate'); }
    finally { setGenerating(false); }
  };

  const downloadReport = async (id: string, format: string) => {
    try {
      const { data } = await api.get(`/report-templates/generated/${id}/download`, {
        params: { format }, responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `report.${format === 'pdf' ? 'html' : format}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  const toggleTag = (tagName: string) => {
    setFormTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Report Builder</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create report templates and generate reports</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-4">
        <button onClick={() => setTab('templates')} className={`py-3 text-sm font-medium border-b-2 ${tab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Templates ({templates.length})
        </button>
        <button onClick={() => setTab('generated')} className={`py-3 text-sm font-medium border-b-2 ${tab === 'generated' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Generated Reports ({generated.length})
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>
        ) : tab === 'templates' ? (
          templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-gray-400">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">No report templates</p>
              <button onClick={openCreate} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">{t.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type] || 'bg-gray-100 text-gray-600'}`}>
                        {t.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {t.description && <p className="text-sm text-gray-500 mb-3">{t.description}</p>}
                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    <p>{t.config.tags?.length || 0} tags • {t.config.timeRange || '24h'} • {t.config.aggregation || 'None'}</p>
                    {t.lastGeneratedAt && <p className="flex items-center gap-1"><Clock className="w-3 h-3" />Last: {new Date(t.lastGeneratedAt).toLocaleString()}</p>}
                  </div>
                  <button onClick={() => handleGenerate(t)} disabled={generating}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <Play className="w-4 h-4" /> Generate Report
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Generated Reports */
          generated.length === 0 ? (
            <div className="text-center text-gray-400 py-20">No reports generated yet</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Format</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Generated</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.format}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => downloadReport(r.id, 'csv')} className="text-xs text-blue-600 hover:text-blue-800">CSV</button>
                          <button onClick={() => downloadReport(r.id, 'pdf')} className="text-xs text-blue-600 hover:text-blue-800">PDF</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Preview data */}
        {previewData && previewData.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">Generated Data ({previewData.length} rows)</h3>
              <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {Object.keys(previewData[0]).map(k => (
                    <th key={k} className="px-3 py-2 text-left font-medium text-gray-600">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2 text-gray-700">{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit Template' : 'Create Template'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white">
                    {REPORT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
                  <select value={formTimeRange} onChange={e => setFormTimeRange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white">
                    {TIME_RANGES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aggregation</label>
                  <select value={formAggregation} onChange={e => setFormAggregation(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white">
                    {AGGREGATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
                  <select value={formGroupBy} onChange={e => setFormGroupBy(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white">
                    {GROUP_BYS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              {/* Tag selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags ({formTags.length} selected)</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {tags.map(t => (
                    <label key={t.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={formTags.includes(t.name)} onChange={() => toggleTag(t.name)} className="rounded" />
                      <span className="text-sm text-gray-700">{t.name}</span>
                    </label>
                  ))}
                  {tags.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No tags in this project</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formName} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
