import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import {
  FileBarChart2, Plus, Trash2, Edit3, Play, ChevronRight, ChevronLeft,
  Search, GripVertical, X, Download, Clock, Save
} from 'lucide-react';

// ─── Types ───────────────────────────────────────
interface TagInfo {
  id: string; name: string; dataType: string; unit: string;
  currentValue: string | null; group: string | null;
}
interface ColumnDef {
  tagName: string; label: string; aggregation: string; unit: string; order: number;
}
interface CalcColumn {
  name: string; label: string; formula: string; unit: string;
}
interface FilterRule {
  tagName: string; operator: string; value: string;
}
interface HighlightRule {
  tagName: string; condition: string; value: string; color: string;
}
interface ReportConfig {
  id?: string; name: string; description: string; projectId: string;
  columns: ColumnDef[]; calculatedColumns: CalcColumn[];
  timeGrouping: string; groupBy: string;
  filters: FilterRule[]; highlightRules: HighlightRule[];
  outputType: string; chartType: string; exportFormats: string[];
  schedule: string; scheduleLabel: string; isShared: boolean;
  lastGenerated?: string; updatedAt?: string;
}
interface PreviewData {
  headers: string[]; rows: any[][]; highlights: { row: number; col: number; color: string }[];
  summary: Record<string, number>;
}

const EMPTY_REPORT: ReportConfig = {
  name: '', description: '', projectId: '',
  columns: [], calculatedColumns: [],
  timeGrouping: '1h', groupBy: 'none',
  filters: [], highlightRules: [],
  outputType: 'table', chartType: 'line', exportFormats: ['csv'],
  schedule: '', scheduleLabel: '', isShared: false,
};

const AGGREGATIONS = ['avg', 'min', 'max', 'sum', 'last', 'count'];
const TIME_GROUPS = [
  { v: '1min', l: '1 Min' }, { v: '5min', l: '5 Min' }, { v: '15min', l: '15 Min' },
  { v: '1h', l: '1 Hour' }, { v: 'shift', l: 'Shift (8h)' }, { v: 'day', l: 'Day' },
];
const OPERATORS = ['>', '<', '==', '!=', '>=', '<='];
const COLORS = [
  { v: '#ef4444', l: 'Red' }, { v: '#f97316', l: 'Orange' }, { v: '#eab308', l: 'Yellow' },
  { v: '#22c55e', l: 'Green' }, { v: '#3b82f6', l: 'Blue' },
];
const SCHEDULES = [
  { v: '', l: 'Manual' }, { v: '0 6 * * *', l: 'Daily 6 AM' },
  { v: '0 18 * * *', l: 'Daily 6 PM' }, { v: '0 6,14,22 * * *', l: 'Every Shift' },
  { v: '0 6 * * 1', l: 'Weekly Monday' }, { v: '0 6 1 * *', l: 'Monthly 1st' },
];
const STEPS = ['Data Sources', 'Time & Grouping', 'Filters & Conditions', 'Output & Schedule', 'Preview & Save'];
const CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#eab308'];

// ─── SVG Chart ───────────────────────────────────
function SimpleChart({ data, chartType }: { data: PreviewData; chartType: string }) {
  if (!data || data.rows.length === 0) return null;
  const W = 700, H = 300, PAD = 50;
  const series = data.headers.slice(1);
  const rows = data.rows;
  const allVals = rows.flatMap(r => r.slice(1).map(Number).filter(v => !isNaN(v)));
  if (allVals.length === 0) return null;
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const xStep = (W - PAD * 2) / Math.max(rows.length - 1, 1);
  const yScale = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  if (chartType === 'bar') {
    const barW = Math.max(2, (W - PAD * 2) / rows.length / series.length - 1);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto">
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = H - PAD - f * (H - PAD * 2);
          return <g key={f}><line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#e5e7eb" /><text x={PAD - 5} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">{(minV + f * range).toFixed(0)}</text></g>;
        })}
        {rows.map((row, ri) =>
          series.map((s, si) => {
            const v = Number(row[si + 1]);
            if (isNaN(v)) return null;
            const x = PAD + ri * (W - PAD * 2) / rows.length + si * barW;
            const h = ((v - minV) / range) * (H - PAD * 2);
            return <rect key={`${ri}-${si}`} x={x} y={H - PAD - h} width={barW} height={h} fill={CHART_COLORS[si % CHART_COLORS.length]} opacity={0.8}
              onMouseEnter={() => setHover({ x: x + barW / 2, y: H - PAD - h - 10, label: `${s}: ${v}` })}
              onMouseLeave={() => setHover(null)} />;
          })
        )}
        {hover && <text x={hover.x} y={hover.y} textAnchor="middle" fontSize={11} fill="#111" fontWeight="bold">{hover.label}</text>}
      </svg>
    );
  }

  // Line chart
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto">
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = H - PAD - f * (H - PAD * 2);
        return <g key={f}><line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#e5e7eb" /><text x={PAD - 5} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">{(minV + f * range).toFixed(0)}</text></g>;
      })}
      {series.map((s, si) => {
        const pts = rows.map((r, i) => {
          const v = Number(r[si + 1]);
          return isNaN(v) ? null : { x: PAD + i * xStep, y: yScale(v), v };
        }).filter(Boolean) as { x: number; y: number; v: number }[];
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return <g key={si}>
          <path d={d} fill="none" stroke={CHART_COLORS[si % CHART_COLORS.length]} strokeWidth={2} />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={CHART_COLORS[si % CHART_COLORS.length]}
            onMouseEnter={() => setHover({ x: p.x, y: p.y - 12, label: `${s}: ${p.v}` })}
            onMouseLeave={() => setHover(null)} />)}
        </g>;
      })}
      {hover && <text x={hover.x} y={hover.y} textAnchor="middle" fontSize={11} fill="#111" fontWeight="bold">{hover.label}</text>}
      <g className="mt-2">{series.map((s, i) => (
        <g key={i} transform={`translate(${PAD + i * 100}, ${H - 10})`}>
          <rect width={10} height={10} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          <text x={14} y={9} fontSize={10} fill="#374151">{s}</text>
        </g>
      ))}</g>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────
export default function ReportDesigner() {
  const currentProjectId = "";
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [editing, setEditing] = useState<ReportConfig | null>(null);
  const [step, setStep] = useState(0);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const projectId = currentProjectId || '';

  const loadReports = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await api.get('/custom-reports', { params: { projectId } });
      setReports(data);
    } catch {}
  }, [projectId]);

  const loadTags = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await api.get('/custom-reports/available-tags', { params: { projectId } });
      setTags(data);
    } catch {}
  }, [projectId]);

  useEffect(() => { loadReports(); loadTags(); }, [loadReports, loadTags]);

  const startNew = () => {
    setEditing({ ...EMPTY_REPORT, projectId });
    setStep(0);
    setPreview(null);
  };

  const startEdit = (r: ReportConfig) => {
    setEditing({
      ...EMPTY_REPORT,
      ...r,
      columns: r.columns || [],
      calculatedColumns: r.calculatedColumns || [],
      filters: r.filters || [],
      highlightRules: r.highlightRules || [],
      exportFormats: r.exportFormats || ['csv'],
    });
    setStep(0);
    setPreview(null);
  };

  const saveReport = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      if (editing.id) {
        await api.put(`/custom-reports/${editing.id}`, editing);
      } else {
        await api.post('/custom-reports', editing);
      }
      setEditing(null);
      loadReports();
    } catch {}
    setLoading(false);
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    try {
      await api.delete(`/custom-reports/${id}`);
      loadReports();
    } catch {}
  };

  const generateNow = async (id: string) => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/custom-reports/${id}/generate`, {
        startDate: new Date(Date.now() - 86_400_000).toISOString(),
        endDate: new Date().toISOString(),
      });
      if (data.output?.id) {
        window.open(`/api/custom-reports/${id}/outputs/${data.output.id}/download?format=csv`, '_blank');
      }
      loadReports();
    } catch {}
    setGenerating(false);
  };

  const loadPreview = async () => {
    if (!editing?.id) {
      // Save first then preview
      setLoading(true);
      try {
        const { data } = editing?.id
          ? await api.put(`/custom-reports/${editing.id}`, editing)
          : await api.post('/custom-reports', editing);
        const id = data.id;
        setEditing({ ...editing!, id });
        const { data: prev } = await api.post(`/custom-reports/${id}/preview`);
        setPreview(prev);
        loadReports();
      } catch {}
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await api.put(`/custom-reports/${editing.id}`, editing);
      const { data } = await api.post(`/custom-reports/${editing.id}/preview`);
      setPreview(data);
    } catch {}
    setLoading(false);
  };

  const addTag = (tag: TagInfo) => {
    if (!editing) return;
    if (editing.columns.find(c => c.tagName === tag.name)) return;
    setEditing({
      ...editing,
      columns: [...editing.columns, {
        tagName: tag.name, label: tag.name, aggregation: 'avg',
        unit: tag.unit || '', order: editing.columns.length,
      }],
    });
  };

  const removeColumn = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, columns: editing.columns.filter((_, i) => i !== idx) });
  };

  const updateColumn = (idx: number, field: string, value: string) => {
    if (!editing) return;
    const cols = [...editing.columns];
    (cols[idx] as any)[field] = value;
    setEditing({ ...editing, columns: cols });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    if (!editing) return;
    const cols = [...editing.columns];
    const ni = idx + dir;
    if (ni < 0 || ni >= cols.length) return;
    [cols[idx], cols[ni]] = [cols[ni], cols[idx]];
    setEditing({ ...editing, columns: cols });
  };

  const addCalcColumn = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      calculatedColumns: [...editing.calculatedColumns, { name: '', label: '', formula: '', unit: '' }],
    });
  };

  const updateCalc = (idx: number, field: string, value: string) => {
    if (!editing) return;
    const cc = [...editing.calculatedColumns];
    (cc[idx] as any)[field] = value;
    setEditing({ ...editing, calculatedColumns: cc });
  };

  const removeCalc = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, calculatedColumns: editing.calculatedColumns.filter((_, i) => i !== idx) });
  };

  const addFilter = () => {
    if (!editing) return;
    setEditing({ ...editing, filters: [...editing.filters, { tagName: '', operator: '>', value: '' }] });
  };

  const updateFilter = (idx: number, field: string, value: string) => {
    if (!editing) return;
    const f = [...editing.filters];
    (f[idx] as any)[field] = value;
    setEditing({ ...editing, filters: f });
  };

  const removeFilter = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, filters: editing.filters.filter((_, i) => i !== idx) });
  };

  const addHighlight = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      highlightRules: [...editing.highlightRules, { tagName: '', condition: '<', value: '', color: '#ef4444' }],
    });
  };

  const updateHighlight = (idx: number, field: string, value: string) => {
    if (!editing) return;
    const h = [...editing.highlightRules];
    (h[idx] as any)[field] = value;
    setEditing({ ...editing, highlightRules: h });
  };

  const removeHighlight = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, highlightRules: editing.highlightRules.filter((_, i) => i !== idx) });
  };

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
    (t.group || '').toLowerCase().includes(tagSearch.toLowerCase())
  );

  const sortedPreviewRows = preview ? (() => {
    if (sortCol === null) return preview.rows;
    const sorted = [...preview.rows].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return sorted;
  })() : [];

  // ─── Report List View ─────────────────────────
  if (!editing) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileBarChart2 className="w-7 h-7 text-blue-600" /> Report Designer
            </h1>
            <p className="text-gray-500 mt-1">Create custom reports with drag-drop tags, formulas, and scheduling</p>
          </div>
          <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Create New Report
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileBarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No custom reports yet</p>
            <p className="text-sm mt-1">Create your first report to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r: any) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900 text-lg truncate">{r.name}</h3>
                <p className="text-gray-500 text-sm mt-1 truncate">{r.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  <span>{(r.columns as any[])?.length || 0} tags</span>
                  <span>•</span>
                  <span>{r.scheduleLabel || 'Manual'}</span>
                  {r.lastGenerated && <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.lastGenerated).toLocaleDateString()}</span>
                  </>}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => startEdit(r)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => generateNow(r.id)} disabled={generating} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded transition">
                    <Play className="w-3.5 h-3.5" /> Generate
                  </button>
                  <button onClick={() => deleteReport(r.id)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded transition ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Wizard View ───────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => { setEditing(null); setPreview(null); }} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Reports
        </button>
        <h2 className="text-xl font-bold text-gray-900">{editing.id ? 'Edit Report' : 'New Report'}</h2>
        <div />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <button onClick={() => setStep(i)} className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition ${
              i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold">{i + 1}</span>
              <span className="hidden md:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 min-h-[400px]">
        {/* ── Step 1: Data Sources ── */}
        {step === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tag Picker */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Available Tags</h3>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                  placeholder="Search tags..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-sm" />
              </div>
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {filteredTags.map(t => (
                  <div key={t.id} onClick={() => addTag(t)}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 text-sm ${
                      editing.columns.find(c => c.tagName === t.name) ? 'bg-blue-50 opacity-60' : ''
                    }`}>
                    <div>
                      <span className="font-medium text-gray-900">{t.name}</span>
                      {t.group && <span className="ml-2 text-xs text-gray-400">[{t.group}]</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t.currentValue ?? '—'} {t.unit}
                    </div>
                  </div>
                ))}
                {filteredTags.length === 0 && <p className="p-4 text-gray-400 text-sm text-center">No tags found</p>}
              </div>
            </div>

            {/* Selected Columns */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Selected Columns ({editing.columns.length})</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {editing.columns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveColumn(i, -1)} className="text-gray-400 hover:text-gray-600"><GripVertical className="w-3 h-3" /></button>
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-24 truncate">{col.tagName}</span>
                    <input value={col.label} onChange={e => updateColumn(i, 'label', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Label" />
                    <select value={col.aggregation} onChange={e => updateColumn(i, 'aggregation', e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                      {AGGREGATIONS.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                    </select>
                    <input value={col.unit} onChange={e => updateColumn(i, 'unit', e.target.value)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Unit" />
                    <button onClick={() => removeColumn(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-700 text-sm">Calculated Columns</h4>
                  <button onClick={addCalcColumn} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {editing.calculatedColumns.map((cc, i) => (
                  <div key={i} className="flex items-center gap-2 bg-yellow-50 rounded-lg p-2 mb-2">
                    <input value={cc.name} onChange={e => updateCalc(i, 'name', e.target.value)}
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Name" />
                    <input value={cc.label} onChange={e => updateCalc(i, 'label', e.target.value)}
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Label" />
                    <input value={cc.formula} onChange={e => updateCalc(i, 'formula', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white font-mono" placeholder="e.g. TagA + TagB" />
                    <input value={cc.unit} onChange={e => updateCalc(i, 'unit', e.target.value)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Unit" />
                    <button onClick={() => removeCalc(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {editing.calculatedColumns.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">Available tags: {editing.columns.map(c => c.tagName).join(', ')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Time & Grouping ── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Grouping</label>
              <div className="flex flex-wrap gap-2">
                {TIME_GROUPS.map(tg => (
                  <button key={tg.v} onClick={() => setEditing({ ...editing, timeGrouping: tg.v })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      editing.timeGrouping === tg.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}>{tg.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
              <select value={editing.groupBy} onChange={e => setEditing({ ...editing, groupBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white">
                <option value="none">None</option>
                <option value="substation">Substation</option>
                <option value="department">Department</option>
                <option value="equipment_type">Equipment Type</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Step 3: Filters & Conditions ── */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Filter Rules</h3>
                <button onClick={addFilter} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Filter
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">Show only rows where conditions are met (AND logic)</p>
              {editing.filters.map((f, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <select value={f.tagName} onChange={e => updateFilter(i, 'tagName', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                    <option value="">Select tag...</option>
                    {editing.columns.map(c => <option key={c.tagName} value={c.tagName}>{c.tagName}</option>)}
                  </select>
                  <select value={f.operator} onChange={e => updateFilter(i, 'operator', e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                    {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={f.value} onChange={e => updateFilter(i, 'value', e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Value" />
                  <button onClick={() => removeFilter(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {editing.filters.length === 0 && <p className="text-sm text-gray-400 italic">No filters — all rows will be shown</p>}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Highlight Rules</h3>
                <button onClick={addHighlight} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>
              {editing.highlightRules.map((h, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <select value={h.tagName} onChange={e => updateHighlight(i, 'tagName', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                    <option value="">Select tag...</option>
                    {editing.columns.map(c => <option key={c.tagName} value={c.tagName}>{c.tagName}</option>)}
                  </select>
                  <select value={h.condition} onChange={e => updateHighlight(i, 'condition', e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                    {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={h.value} onChange={e => updateHighlight(i, 'value', e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white" placeholder="Value" />
                  <select value={h.color} onChange={e => updateHighlight(i, 'color', e.target.value)}
                    className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 bg-white">
                    {COLORS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                  <span className="w-5 h-5 rounded" style={{ background: h.color }} />
                  <button onClick={() => removeHighlight(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {editing.highlightRules.length === 0 && <p className="text-sm text-gray-400 italic">No highlight rules</p>}
            </div>
          </div>
        )}

        {/* ── Step 4: Output & Schedule ── */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Output Type</label>
              <div className="flex gap-2">
                {['table', 'chart', 'both'].map(o => (
                  <button key={o} onClick={() => setEditing({ ...editing, outputType: o })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition capitalize ${
                      editing.outputType === o ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}>{o === 'both' ? 'Table + Chart' : o}</button>
                ))}
              </div>
            </div>
            {(editing.outputType === 'chart' || editing.outputType === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
                <div className="flex gap-2">
                  {['line', 'bar'].map(ct => (
                    <button key={ct} onClick={() => setEditing({ ...editing, chartType: ct })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition capitalize ${
                        editing.chartType === ct ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}>{ct}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Formats</label>
              <div className="flex gap-3">
                {['csv', 'excel', 'pdf'].map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editing.exportFormats.includes(f)}
                      onChange={e => {
                        const fmts = e.target.checked
                          ? [...editing.exportFormats, f]
                          : editing.exportFormats.filter(x => x !== f);
                        setEditing({ ...editing, exportFormats: fmts });
                      }} className="rounded" />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULES.map(s => (
                  <button key={s.v} onClick={() => setEditing({ ...editing, schedule: s.v, scheduleLabel: s.l })}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      editing.schedule === s.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}>{s.l}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={editing.isShared}
                onChange={e => setEditing({ ...editing, isShared: e.target.checked })} className="rounded" />
              Share with team
            </label>
          </div>
        )}

        {/* ── Step 5: Preview & Save ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Name *</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white" placeholder="e.g. Daily Voltage Summary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white" placeholder="Optional description" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={loadPreview} disabled={loading || editing.columns.length === 0}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition disabled:opacity-50">
                {loading ? 'Loading...' : 'Load Preview'}
              </button>
              <button onClick={saveReport} disabled={loading || !editing.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Report
              </button>
              {editing.id && (
                <button onClick={() => generateNow(editing.id!)} disabled={generating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Generate Now
                </button>
              )}
            </div>

            {/* Preview Table */}
            {preview && (editing.outputType === 'table' || editing.outputType === 'both') && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      {preview.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-700"
                          onClick={() => { setSortCol(i); setSortDir(sortCol === i && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          {h} {sortCol === i && (sortDir === 'asc' ? '↑' : '↓')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPreviewRows.slice(0, 50).map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                        {row.map((cell: any, ci: number) => {
                          const hl = preview.highlights.find(h => h.row === ri && h.col === ci);
                          return (
                            <td key={ci} className="px-3 py-1.5" style={hl ? { background: hl.color, color: '#fff' } : {}}>
                              {ci === 0 ? new Date(cell).toLocaleTimeString() : (cell !== null ? Number(cell).toFixed(2) : '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Summary Row */}
                    {preview.summary && (
                      <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                        <td className="px-3 py-2">Average</td>
                        {preview.headers.slice(1).map((h, i) => (
                          <td key={i} className="px-3 py-2">{preview.summary[h]?.toFixed(2) ?? '—'}</td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chart Preview */}
            {preview && (editing.outputType === 'chart' || editing.outputType === 'both') && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <SimpleChart data={preview} chartType={editing.chartType || 'line'} />
              </div>
            )}

            {!preview && editing.columns.length > 0 && (
              <p className="text-center text-gray-400 py-8">Click "Load Preview" to see report data</p>
            )}
            {editing.columns.length === 0 && (
              <p className="text-center text-gray-400 py-8">Add tags in Step 1 to preview data</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-30 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 flex items-center gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
