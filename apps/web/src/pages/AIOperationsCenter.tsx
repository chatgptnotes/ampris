import { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  Send,
  FileText,
  Play,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Clock,
  BarChart3,
  Gauge,
  User,
  Bot,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/services/api';

const TOOLTIP_STYLE = {
  backgroundColor: '#1E293B',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#E2E8F0',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DailyReport {
  date: string;
  summary: { peakLoadMW: number; peakTime: string; minLoadMW: number; minTime: string; avgLoadMW: number; energyMWh: number; loadFactor: number };
  alarms: { total: number; critical: number; warning: number; info: number; topAlarm: string };
  equipment: { healthyCount: number; degradedCount: number; criticalCount: number; statusChanges: string[] };
  powerQuality: { avgPF: number; minPF: number; thdAvg: number; voltageEvents: number };
  recommendations: string[];
}

interface WhatIfResult {
  scenario: string;
  impacts: { parameter: string; before: string; after: string; severity: string }[];
  recommendations: string[];
  riskLevel: string;
}

const QUICK_PROMPTS = [
  'What caused the voltage dip at 14:23?',
  'Predict load for next Sunday',
  'Which equipment needs maintenance this month?',
  'Optimize switching sequence for minimum losses',
];

const WHATIF_SCENARIOS = [
  'What if Transformer TR1 trips?',
  'What if load increases by 20%?',
  'What if we add a 5 MVAR capacitor bank?',
];

export default function AIOperationsCenter() {
  const [activeTab, setActiveTab] = useState<'chat' | 'report' | 'whatif'>('chat');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I\'m your AI Operations Assistant. I can help you analyze SCADA data, predict loads, diagnose faults, and optimize your power system. What would you like to know?', timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Report state
  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // What-If state
  const [whatIfScenario, setWhatIfScenario] = useState('');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;

    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setChatLoading(true);

    try {
      const { data } = await api.post('/ai/chat', { message: msg });
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.response, timestamp: data.timestamp };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error processing your request. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function generateReport() {
    setReportLoading(true);
    try {
      const { data } = await api.get('/ai/daily-report');
      setReport(data);
    } catch {
      console.error('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  }

  async function runWhatIf(scenario?: string) {
    const s = scenario || whatIfScenario.trim();
    if (!s) return;
    setWhatIfScenario(s);
    setWhatIfLoading(true);
    try {
      const { data } = await api.post('/ai/what-if', { scenario: s });
      setWhatIfResult(data);
    } catch {
      console.error('What-If simulation failed');
    } finally {
      setWhatIfLoading(false);
    }
  }

  return (
    <div className="space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-scada-accent" />
          AI Operations Center
        </h2>
        <div className="flex gap-1">
          {(['chat', 'report', 'whatif'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded ${activeTab === tab ? 'bg-scada-accent text-white' : 'bg-scada-panel text-gray-400 border border-scada-border'}`}>
              {tab === 'chat' ? 'AI Assistant' : tab === 'report' ? 'Daily Report' : 'What-If'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="bg-scada-panel border border-scada-border rounded-lg flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
          {/* Quick prompts */}
          <div className="flex gap-2 p-3 border-b border-scada-border overflow-x-auto">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button key={i} onClick={() => sendMessage(prompt)}
                className="shrink-0 px-3 py-1.5 text-xs rounded-full bg-scada-accent/10 text-scada-accent border border-scada-accent/20 hover:bg-scada-accent/20">
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-scada-accent/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-scada-accent" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-scada-accent text-white' : 'bg-scada-bg'}`}>
                  <div className="whitespace-pre-wrap">{msg.content.split('\n').map((line, li) => {
                    // Simple markdown-like rendering
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <div key={li} className="font-bold mt-2 mb-1">{line.replace(/\*\*/g, '')}</div>;
                    }
                    if (line.startsWith('- ')) {
                      return <div key={li} className="ml-2">• {line.slice(2)}</div>;
                    }
                    if (line.match(/^\d+\./)) {
                      return <div key={li} className="ml-2">{line}</div>;
                    }
                    return <div key={li}>{line}</div>;
                  })}</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-green-400" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-scada-accent/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-scada-accent" />
                </div>
                <div className="bg-scada-bg rounded-lg p-3 flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-scada-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about your SCADA system..."
                className="flex-1 bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-scada-accent"
              />
              <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()}
                className="px-4 py-2 bg-scada-accent text-white rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Report Tab */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {!report && (
            <div className="bg-scada-panel border border-scada-border rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-scada-accent mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Daily Operations Report</h3>
              <p className="text-sm text-gray-400 mb-4">Generate an AI-powered summary of today's operations, including load analysis, alarms, equipment status, and recommendations.</p>
              <button onClick={generateReport} disabled={reportLoading}
                className="px-6 py-2 bg-scada-accent text-white rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto">
                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Generate Report
              </button>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {/* Report Header */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Daily Operations Report — {new Date(report.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h3>
                  <p className="text-xs text-gray-400">Auto-generated by AI Analytics Engine</p>
                </div>
                <button onClick={generateReport} className="px-3 py-1.5 text-xs bg-scada-accent text-white rounded flex items-center gap-1">
                  <Download className="w-3 h-3" /> Regenerate
                </button>
              </div>

              {/* Load Summary */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Load Summary</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div><span className="text-xs text-gray-400">Peak Load</span><div className="text-lg font-bold font-mono">{report.summary.peakLoadMW} MW</div><div className="text-xs text-gray-400">at {report.summary.peakTime}</div></div>
                  <div><span className="text-xs text-gray-400">Min Load</span><div className="text-lg font-bold font-mono">{report.summary.minLoadMW} MW</div><div className="text-xs text-gray-400">at {report.summary.minTime}</div></div>
                  <div><span className="text-xs text-gray-400">Average Load</span><div className="text-lg font-bold font-mono">{report.summary.avgLoadMW} MW</div></div>
                  <div><span className="text-xs text-gray-400">Energy</span><div className="text-lg font-bold font-mono">{report.summary.energyMWh} MWh</div><div className="text-xs text-gray-400">LF: {(report.summary.loadFactor * 100).toFixed(1)}%</div></div>
                </div>
              </div>

              {/* Alarms Summary */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" /> Alarm Summary</h4>
                <div className="flex items-center gap-6 mb-2">
                  <div className="text-center"><div className="text-2xl font-bold font-mono">{report.alarms.total}</div><div className="text-xs text-gray-400">Total</div></div>
                  <div className="text-center"><div className="text-2xl font-bold font-mono text-red-400">{report.alarms.critical}</div><div className="text-xs text-gray-400">Critical</div></div>
                  <div className="text-center"><div className="text-2xl font-bold font-mono text-yellow-400">{report.alarms.warning}</div><div className="text-xs text-gray-400">Warning</div></div>
                  <div className="text-center"><div className="text-2xl font-bold font-mono text-blue-400">{report.alarms.info}</div><div className="text-xs text-gray-400">Info</div></div>
                </div>
                <div className="text-xs text-gray-400">Top alarm: {report.alarms.topAlarm}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Equipment Status */}
                <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Gauge className="w-4 h-4 text-green-400" /> Equipment Status</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={[
                      { status: 'Healthy', count: report.equipment.healthyCount },
                      { status: 'Degraded', count: report.equipment.degradedCount },
                      { status: 'Critical', count: report.equipment.criticalCount },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="status" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Equipment">
                        <Cell fill="#10B981" />
                        <Cell fill="#EAB308" />
                        <Cell fill="#DC2626" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {report.equipment.statusChanges.length > 0 && (
                    <div className="mt-2 text-xs space-y-1">
                      {report.equipment.statusChanges.map((c, i) => (
                        <div key={i} className="text-yellow-400">• {c}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Power Quality */}
                <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-400" /> Power Quality</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-xs text-gray-400">Avg PF</span><div className={`text-lg font-bold font-mono ${report.powerQuality.avgPF >= 0.9 ? 'text-green-400' : 'text-red-400'}`}>{report.powerQuality.avgPF}</div></div>
                    <div><span className="text-xs text-gray-400">Min PF</span><div className={`text-lg font-bold font-mono ${report.powerQuality.minPF >= 0.9 ? 'text-green-400' : 'text-red-400'}`}>{report.powerQuality.minPF}</div></div>
                    <div><span className="text-xs text-gray-400">THD Avg</span><div className={`text-lg font-bold font-mono ${report.powerQuality.thdAvg <= 8 ? 'text-green-400' : 'text-red-400'}`}>{report.powerQuality.thdAvg}%</div></div>
                    <div><span className="text-xs text-gray-400">Voltage Events</span><div className="text-lg font-bold font-mono">{report.powerQuality.voltageEvents}</div></div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-scada-accent" /> AI Recommendations for Tomorrow</h4>
                <div className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-scada-accent font-bold shrink-0">{i + 1}.</span>
                      <span className="text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-If Tab */}
      {activeTab === 'whatif' && (
        <div className="space-y-4">
          <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">What-If Simulator</h3>
            <p className="text-xs text-gray-400 mb-3">Simulate contingency scenarios and see the impact on your power system.</p>

            {/* Quick scenarios */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {WHATIF_SCENARIOS.map((s, i) => (
                <button key={i} onClick={() => runWhatIf(s)}
                  className="px-3 py-1.5 text-xs rounded-full bg-scada-accent/10 text-scada-accent border border-scada-accent/20 hover:bg-scada-accent/20">
                  {s}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="flex gap-2">
              <input
                value={whatIfScenario}
                onChange={e => setWhatIfScenario(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runWhatIf()}
                placeholder="Describe a scenario... (e.g., 'What if load increases by 30%?')"
                className="flex-1 bg-scada-bg border border-scada-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-scada-accent"
              />
              <button onClick={() => runWhatIf()} disabled={whatIfLoading || !whatIfScenario.trim()}
                className="px-4 py-2 bg-scada-accent text-white rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm">
                {whatIfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Simulate
              </button>
            </div>
          </div>

          {/* Results */}
          {whatIfResult && (
            <div className="space-y-4">
              {/* Scenario Banner */}
              <div className={`rounded-lg p-4 border ${whatIfResult.riskLevel === 'high' ? 'bg-red-900/10 border-red-600/20' : whatIfResult.riskLevel === 'medium' ? 'bg-yellow-900/10 border-yellow-600/20' : 'bg-green-900/10 border-green-600/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {whatIfResult.riskLevel === 'high' ? <XCircle className="w-5 h-5 text-red-400" /> :
                     whatIfResult.riskLevel === 'medium' ? <AlertTriangle className="w-5 h-5 text-yellow-400" /> :
                     <CheckCircle className="w-5 h-5 text-green-400" />}
                    <span className="font-medium">{whatIfResult.scenario}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${whatIfResult.riskLevel === 'high' ? 'bg-red-900/30 text-red-400' : whatIfResult.riskLevel === 'medium' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
                    {whatIfResult.riskLevel} risk
                  </span>
                </div>
              </div>

              {/* Impact Table */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3">Impact Analysis</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 text-xs border-b border-scada-border">
                        <th className="px-3 py-2">Parameter</th>
                        <th className="px-3 py-2">Before</th>
                        <th className="px-3 py-2"></th>
                        <th className="px-3 py-2">After</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whatIfResult.impacts.map((impact, i) => (
                        <tr key={i} className="border-b border-scada-border/30">
                          <td className="px-3 py-2 font-medium">{impact.parameter}</td>
                          <td className="px-3 py-2 font-mono text-gray-300">{impact.before}</td>
                          <td className="px-3 py-2 text-gray-500"><span className="text-lg">→</span></td>
                          <td className={`px-3 py-2 font-mono font-bold ${impact.severity === 'critical' ? 'text-red-400' : impact.severity === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>
                            {impact.after}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${impact.severity === 'critical' ? 'bg-red-900/30 text-red-400' : impact.severity === 'warning' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
                              {impact.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-scada-panel border border-scada-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3">Recommended Actions</h4>
                <div className="space-y-2">
                  {whatIfResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`font-bold shrink-0 ${i === 0 && whatIfResult.riskLevel === 'high' ? 'text-red-400' : 'text-scada-accent'}`}>{i + 1}.</span>
                      <span className="text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
