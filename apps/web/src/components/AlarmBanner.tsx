import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { Bell, BellOff, Volume2, VolumeX, ChevronUp, ChevronDown, CheckCheck, X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

interface ActiveAlarm {
  id: string;
  definitionId: string;
  alarmName: string;
  tagName: string;
  condition: string;
  severity: number;
  triggerValue: number | null;
  setpoint: number | null;
  state: string;
  activatedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  ackComment: string | null;
  projectId: string;
}

const SEVERITY_CONFIG: Record<number, { label: string; color: string; bg: string; icon: any; flash?: boolean }> = {
  1: { label: 'LOW', color: 'text-blue-400', bg: 'bg-blue-900/50 border-blue-700', icon: Info },
  2: { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-900/50 border-yellow-700', icon: AlertCircle },
  3: { label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-900/50 border-orange-700', icon: AlertTriangle },
  4: { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-900/50 border-red-700', icon: AlertTriangle, flash: true },
  5: { label: 'EMERGENCY', color: 'text-red-300', bg: 'bg-red-800/70 border-red-600', icon: AlertTriangle, flash: true },
};

export default function AlarmBanner() {
  const [alarms, setAlarms] = useState<ActiveAlarm[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ackDialog, setAckDialog] = useState<ActiveAlarm | null>(null);
  const [ackComment, setAckComment] = useState('');

  const fetchAlarms = useCallback(async () => {
    try {
      const { data } = await api.get('/project-alarms/active');
      if (!Array.isArray(data)) return;
      setAlarms(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 2000);
    return () => clearInterval(interval);
  }, [fetchAlarms]);

  const handleAck = async (alarm: ActiveAlarm) => {
    try {
      await api.post(`/project-alarms/${alarm.id}/acknowledge`, { comment: ackComment || undefined });
      setAckDialog(null);
      setAckComment('');
      fetchAlarms();
    } catch {}
  };

  const handleAckAll = async () => {
    try {
      await api.post('/project-alarms/acknowledge-all', {});
      fetchAlarms();
    } catch {}
  };

  const counts = alarms.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  if (alarms.length === 0) return null;

  return (
    <>
      <div className={clsx(
        'fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 transition-all duration-300',
        expanded ? 'h-60' : 'h-[40px]'
      )}>
        {/* Header bar */}
        <div className="flex items-center h-[40px] px-3 gap-3 border-b border-gray-800">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <Bell className="w-4 h-4 text-red-400 animate-pulse" />

          {/* Severity badges */}
          <div className="flex items-center gap-2 text-xs">
            {counts[5] ? <span className="text-red-300 animate-pulse">{counts[5]} EMG</span> : null}
            {counts[4] ? <span className="text-red-400 animate-pulse">{counts[4]} CRT</span> : null}
            {counts[3] ? <span className="text-orange-400">{counts[3]} HIGH</span> : null}
            {counts[2] ? <span className="text-yellow-400">{counts[2]} MED</span> : null}
            {counts[1] ? <span className="text-blue-400">{counts[1]} LOW</span> : null}
          </div>

          <div className="flex-1" />

          {/* Scrolling latest alarm */}
          {!expanded && alarms[0] && (
            <span className={clsx('text-xs font-mono truncate max-w-[400px]', SEVERITY_CONFIG[alarms[0].severity]?.color)}>
              {alarms[0].alarmName} — {alarms[0].tagName} = {alarms[0].triggerValue ?? '?'} ({alarms[0].state})
            </span>
          )}

          <div className="flex-1" />

          <button onClick={handleAckAll} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1" title="Ack All">
            <CheckCheck className="w-3.5 h-3.5" /> Ack All
          </button>
          <button onClick={() => setMuted(!muted)} className="text-gray-400 hover:text-white" title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded alarm list */}
        {expanded && (
          <div className="overflow-y-auto h-[calc(100%-40px)] text-xs">
            {alarms.map(alarm => {
              const cfg = SEVERITY_CONFIG[alarm.severity] || SEVERITY_CONFIG[2];
              const Icon = cfg.icon;
              return (
                <div
                  key={alarm.id}
                  onClick={() => { setAckDialog(alarm); setAckComment(''); }}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-1.5 border-b cursor-pointer hover:bg-gray-800/50',
                    cfg.bg,
                    cfg.flash && 'animate-pulse'
                  )}
                >
                  <Icon className={clsx('w-4 h-4 shrink-0', cfg.color)} />
                  <span className="text-gray-400 font-mono w-[140px] shrink-0">
                    {new Date(alarm.activatedAt).toLocaleTimeString()}
                  </span>
                  <span className={clsx('font-semibold w-16 shrink-0', cfg.color)}>{cfg.label}</span>
                  <span className="text-white font-medium truncate flex-1">{alarm.alarmName}</span>
                  <span className="text-gray-400 font-mono">{alarm.tagName}</span>
                  <span className="text-gray-300 font-mono w-24 text-right">
                    {alarm.triggerValue != null ? alarm.triggerValue.toFixed(1) : '—'} / {alarm.setpoint != null ? alarm.setpoint.toFixed(1) : '—'}
                  </span>
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-bold',
                    alarm.state === 'ACTIVE_UNACK' ? 'bg-red-600 text-white' :
                    alarm.state === 'ACTIVE_ACK' ? 'bg-green-700 text-white' :
                    'bg-yellow-600 text-white'
                  )}>
                    {alarm.state === 'ACTIVE_UNACK' ? 'UNACK' : alarm.state === 'ACTIVE_ACK' ? 'ACK' : 'CLR'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Acknowledge dialog */}
      {ackDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-5 w-96">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Acknowledge Alarm</h3>
              <button onClick={() => setAckDialog(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-gray-600 mb-3 space-y-1">
              <div><strong>Alarm:</strong> {ackDialog.alarmName}</div>
              <div><strong>Tag:</strong> {ackDialog.tagName}</div>
              <div><strong>Value:</strong> {ackDialog.triggerValue} / Setpoint: {ackDialog.setpoint}</div>
            </div>
            <textarea
              value={ackComment}
              onChange={(e) => setAckComment(e.target.value)}
              placeholder="Comment (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-gray-900 bg-white mb-3"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAckDialog(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
              <button onClick={() => handleAck(ackDialog)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Acknowledge</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
