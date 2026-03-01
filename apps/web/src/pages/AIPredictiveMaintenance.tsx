import { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Calendar,
  AlertTriangle,
  DollarSign,
  Package,
  Clock,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/services/api';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#E2E8F0',
};

const PIE_COLORS = ['#DC2626', '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EAB308'];

interface MaintenanceTask {
  id: string;
  equipment: string;
  type: 'routine' | 'predicted' | 'urgent';
  task: string;
  scheduledDate: string;
  estimatedDuration: string;
  estimatedCost: number;
  failureProbability?: { days7: number; days30: number; days90: number };
  reason: string;
}

interface SparePartSuggestion {
  part: string;
  forEquipment: string;
  quantity: number;
  leadTimeDays: number;
  predictedNeedDays: number;
  urgency: string;
  estimatedCost: number;
}

interface CostAnalysis {
  preventiveCost: number;
  correctiveCost: number;
  savings: number;
  annualBudget: { category: string; amount: number }[];
  monthlyTrend: { month: string; preventive: number; corrective: number }[];
}

export default function AIPredictiveMaintenance() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [spareParts, setSpareParts] = useState<SparePartSuggestion[]>([]);
  const [costData, setCostData] = useState<CostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'predictions' | 'costs' | 'parts'>('calendar');

  useEffect(() => {
    Promise.all([
      api.get('/ai/maintenance'),
      api.get('/ai/spare-parts'),
      api.get('/ai/cost-analysis'),
    ])
      .then(([tRes, spRes, cRes]) => {
        setTasks(tRes.data);
        setSpareParts(spRes.data);
        setCostData(cRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sortedTasks = useMemo(() =>
    [...tasks].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
    [tasks]
  );

  const tasksByType = useMemo(() => ({
    urgent: tasks.filter(t => t.type === 'urgent'),
    predicted: tasks.filter(t => t.type === 'predicted'),
    routine: tasks.filter(t => t.type === 'routine'),
  }), [tasks]);

  const totalCost = useMemo(() => tasks.reduce((s, t) => s + t.estimatedCost, 0), [tasks]);

  function typeColor(type: string) {
    if (type === 'urgent') return 'bg-red-900/30 text-red-400 border-red-600/30';
    if (type === 'predicted') return 'bg-orange-900/30 text-orange-400 border-orange-600/30';
    return 'bg-blue-900/30 text-blue-400 border-blue-600/30';
  }

  function urgencyBadge(urgency: string) {
    const map: Record<string, string> = {
      order_now: 'bg-red-900/30 text-red-400',
      plan_ahead: 'bg-yellow-900/30 text-yellow-400',
      stock_check: 'bg-blue-900/30 text-blue-400',
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${map[urgency] || map.stock_check}`}>{urgency.replace(/_/g, ' ').toUpperCase()}</span>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-scada-panel rounded animate-pulse w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-scada-panel rounded-lg animate-pulse" />)}
        </div>
        <div className="h-96 bg-scada-panel rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-scada-accent" />
          Predictive Maintenance
        </h2>
        <div className="flex gap-1">
          {(['calendar', 'predictions', 'costs', 'parts'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded capitalize ${activeTab === tab ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><AlertTriangle className="w-4 h-4 text-red-400" /> Urgent</div>
          <div className="text-2xl font-bold font-mono text-red-400">{tasksByType.urgent.length}</div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Clock className="w-4 h-4 text-orange-400" /> Predicted</div>
          <div className="text-2xl font-bold font-mono text-orange-400">{tasksByType.predicted.length}</div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Calendar className="w-4 h-4 text-blue-400" /> Routine</div>
          <div className="text-2xl font-bold font-mono text-blue-400">{tasksByType.routine.length}</div>
        </div>
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><DollarSign className="w-4 h-4" /> Total Cost</div>
          <div className="text-2xl font-bold font-mono">₹{(totalCost / 1000).toFixed(0)}K</div>
        </div>
      </div>

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-4">Maintenance Timeline</h3>
          <div className="space-y-3">
            {sortedTasks.map(task => {
              const daysAway = Math.ceil((new Date(task.scheduledDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={task.id} className={`p-4 rounded-lg border ${typeColor(task.type)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${typeColor(task.type)}`}>{task.type}</span>
                        <span className="font-medium text-sm">{task.equipment}</span>
                      </div>
                      <div className="text-sm text-gray-300">{task.task}</div>
                      <div className="text-xs text-gray-400 mt-1">{task.reason}</div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-mono">{new Date(task.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                      <div className={`text-xs ${daysAway <= 7 ? 'text-red-400' : daysAway <= 30 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {daysAway} days away
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{task.estimatedDuration}</div>
                      <div className="text-xs font-mono">₹{task.estimatedCost.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Predictions Tab */}
      {activeTab === 'predictions' && (
        <div className="space-y-4">
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-4">Equipment Failure Predictions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                    <th className="px-3 py-2">Equipment</th>
                    <th className="px-3 py-2">7 Days</th>
                    <th className="px-3 py-2">30 Days</th>
                    <th className="px-3 py-2">90 Days</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.filter(t => t.failureProbability).map(task => (
                    <tr key={task.id} className="border-b border-scada-border/30 hover:bg-scada-border/20">
                      <td className="px-3 py-3 font-medium">{task.equipment}</td>
                      <td className="px-3 py-3">
                        <ProbabilityBar value={task.failureProbability!.days7} />
                      </td>
                      <td className="px-3 py-3">
                        <ProbabilityBar value={task.failureProbability!.days30} />
                      </td>
                      <td className="px-3 py-3">
                        <ProbabilityBar value={task.failureProbability!.days90} />
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-300 max-w-[200px]">{task.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && costData && (
        <div className="space-y-4">
          {/* Cost Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">Preventive Cost</div>
              <div className="text-2xl font-bold font-mono text-blue-400">₹{(costData.preventiveCost / 1000).toFixed(0)}K</div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">Corrective Cost (if no action)</div>
              <div className="text-2xl font-bold font-mono text-red-400">₹{(costData.correctiveCost / 1000).toFixed(0)}K</div>
            </div>
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4 text-center">
              <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" /> Savings</div>
              <div className="text-2xl font-bold font-mono text-green-400">₹{(costData.savings / 1000).toFixed(0)}K</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Trend */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Monthly Maintenance Cost</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={costData.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `₹${(v as number / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="preventive" stroke="#3B82F6" strokeWidth={2} name="Preventive" />
                  <Line type="monotone" dataKey="corrective" stroke="#DC2626" strokeWidth={2} name="Corrective" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Annual Budget Pie */}
            <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Annual Maintenance Budget</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={costData.annualBudget}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {costData.annualBudget.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center text-xs text-gray-400">
                Total: ₹{costData.annualBudget.reduce((s, b) => s + b.amount, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spare Parts Tab */}
      {activeTab === 'parts' && (
        <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Spare Parts Inventory Recommendations
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                  <th className="px-3 py-2">Part</th>
                  <th className="px-3 py-2">For Equipment</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Lead Time</th>
                  <th className="px-3 py-2">Need In</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {spareParts.map((sp, i) => {
                  const isLate = sp.leadTimeDays >= sp.predictedNeedDays;
                  return (
                    <tr key={i} className="border-b border-scada-border/30 hover:bg-scada-border/20">
                      <td className="px-3 py-2 font-medium">{sp.part}</td>
                      <td className="px-3 py-2 text-gray-300">{sp.forEquipment}</td>
                      <td className="px-3 py-2 font-mono">{sp.quantity}</td>
                      <td className="px-3 py-2 font-mono">{sp.leadTimeDays}d</td>
                      <td className="px-3 py-2">
                        <span className={`font-mono ${isLate ? 'text-red-400' : 'text-green-400'}`}>{sp.predictedNeedDays}d</span>
                        {isLate && (
                          <span className="text-red-400 text-xs ml-1 flex items-center gap-0.5 inline-flex">
                            <AlertTriangle className="w-3 h-3" /> Late!
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{urgencyBadge(sp.urgency)}</td>
                      <td className="px-3 py-2 font-mono">₹{sp.estimatedCost.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 50 ? 'bg-red-500' : pct >= 20 ? 'bg-orange-500' : pct >= 10 ? 'bg-yellow-500' : 'bg-green-500';
  const textColor = pct >= 50 ? 'text-red-400' : pct >= 20 ? 'text-orange-400' : pct >= 10 ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-scada-bg rounded-full max-w-[80px]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs ${textColor}`}>{pct}%</span>
    </div>
  );
}
