import { useState, useMemo, useEffect } from 'react';
import { useDigitalState, useNumericValue } from '@/hooks/useRealTimeData';
import { useAuthStore } from '@/stores/authStore';
import { useControl } from '@/hooks/useControl';
import { api } from '@/services/api';
import type { CommandType } from '@gridvision/shared';
import {
  ToggleLeft,
  ToggleRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Check,
  XCircle,
  Shield,
  Clock,
} from 'lucide-react';

interface CommandHistoryItem {
  id: string;
  equipmentTag: string;
  commandType: string;
  state: string;
  executedAt?: string;
  user?: { name: string };
}

export default function ControlPanel() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canOperate = hasPermission('control:operate');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);

  useEffect(() => {
    api.get('/control/history').then(({ data }) => {
      setCommandHistory(data.slice(0, 20));
    }).catch(() => {});
  }, []);

  if (!canOperate) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <Shield className="w-12 h-12" />
        <p className="text-lg">Control operations require Operator, Supervisor, or Admin role.</p>
        <p className="text-sm">Current role: <span className="text-scada-accent">{user?.role}</span></p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Control Panel</h2>

      {/* Circuit Breaker Controls */}
      <div className="bg-scada-panel border border-scada-border rounded-lg">
        <div className="px-4 py-2.5 border-b border-scada-border">
          <h3 className="text-sm font-medium">Circuit Breaker Controls</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CBControl tag="INC_33KV_CB" label="33kV Incoming CB" equipmentId="inc-33kv-cb" />
          <CBControl tag="TR1_HV_CB" label="TR1 HV CB" equipmentId="tr1-hv-cb" />
          <CBControl tag="TR1_LV_CB" label="TR1 LV CB" equipmentId="tr1-lv-cb" />
          <CBControl tag="TR2_HV_CB" label="TR2 HV CB" equipmentId="tr2-hv-cb" />
          <CBControl tag="TR2_LV_CB" label="TR2 LV CB" equipmentId="tr2-lv-cb" />
          <CBControl tag="BUS_TIE_CB" label="Bus Tie CB" equipmentId="bus-tie-cb" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CBControl
              key={i}
              tag={`FDR${String(i).padStart(2, '0')}_CB`}
              label={`Feeder ${i} CB`}
              equipmentId={`fdr${String(i).padStart(2, '0')}-cb`}
            />
          ))}
        </div>
      </div>

      {/* Tap Changer Controls */}
      <div className="bg-scada-panel border border-scada-border rounded-lg">
        <div className="px-4 py-2.5 border-b border-scada-border">
          <h3 className="text-sm font-medium">Tap Changer Controls</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TapControl prefix="TR1" label="Transformer 1" equipmentId="tr1-tap" />
          <TapControl prefix="TR2" label="Transformer 2" equipmentId="tr2-tap" />
        </div>
      </div>

      {/* Command History */}
      <div className="bg-scada-panel border border-scada-border rounded-lg">
        <div className="px-4 py-2.5 border-b border-scada-border flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium">Command History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-scada-border">
                <th className="text-left px-4 py-2">Equipment</th>
                <th className="text-left px-4 py-2">Command</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Operator</th>
              </tr>
            </thead>
            <tbody>
              {commandHistory.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No recent commands</td></tr>
              ) : (
                commandHistory.map((cmd) => (
                  <tr key={cmd.id} className="border-b border-scada-border/50 hover:bg-scada-bg/50">
                    <td className="px-4 py-2 font-mono text-xs">{cmd.equipmentTag}</td>
                    <td className="px-4 py-2">{cmd.commandType}</td>
                    <td className="px-4 py-2">
                      <CommandStateBadge state={cmd.state} />
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {cmd.executedAt ? new Date(cmd.executedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '---'}
                    </td>
                    <td className="px-4 py-2 text-xs">{cmd.user?.name || '---'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── CB Control ───────────────────

function CBControl({ tag, label, equipmentId }: { tag: string; label: string; equipmentId: string }) {
  const state = useDigitalState(tag);
  const isClosed = state === true;
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const { selectResponse, result, loading, error, select, execute, cancel, reset } = useControl();

  const handleOpen = () => {
    setShowConfirm(true);
    setReason('');
    reset();
    select(equipmentId, 'OPEN');
  };

  const handleClose = () => {
    setShowConfirm(true);
    setReason('');
    reset();
    select(equipmentId, 'CLOSE');
  };

  const handleExecute = () => {
    if (selectResponse) execute(selectResponse.commandId);
  };

  const handleCancel = () => {
    if (selectResponse) cancel(selectResponse.commandId);
    setShowConfirm(false);
    reset();
  };

  const statusBg = state === undefined
    ? 'border-gray-600'
    : isClosed
      ? 'border-green-700 bg-green-900/20'
      : 'border-red-700 bg-red-900/20';

  return (
    <>
      <div className={`border rounded-lg p-3 ${statusBg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{label}</span>
          {isClosed ? (
            <ToggleRight className="w-5 h-5 text-green-400" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className={`text-sm font-bold mb-2 ${isClosed ? 'text-green-400' : 'text-red-400'}`}>
          {state === undefined ? 'UNKNOWN' : isClosed ? 'CLOSED' : 'OPEN'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpen}
            disabled={!isClosed || loading}
            className="flex-1 py-1.5 text-xs font-medium rounded bg-red-800/50 hover:bg-red-700 disabled:opacity-30 text-red-200"
          >
            OPEN
          </button>
          <button
            onClick={handleClose}
            disabled={isClosed || loading}
            className="flex-1 py-1.5 text-xs font-medium rounded bg-green-800/50 hover:bg-green-700 disabled:opacity-30 text-green-200"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-scada-panel border border-scada-border rounded-lg w-[420px] shadow-2xl">
            <div className="px-4 py-3 border-b border-scada-border flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">Confirm Control Operation</h3>
            </div>
            <div className="p-4 space-y-3">
              {result && (
                <div className={`p-2 rounded text-sm ${result.success ? 'bg-green-900/30 border border-green-800 text-green-300' : 'bg-red-900/30 border border-red-800 text-red-300'}`}>
                  {result.success ? <Check className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                  {result.message}
                </div>
              )}
              {error && (
                <div className="p-2 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>
              )}

              {selectResponse && !result && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-400">Equipment:</span> <span className="font-mono">{selectResponse.equipmentTag}</span></div>
                    <div><span className="text-gray-400">Action:</span> <span className="text-yellow-400 font-bold">{selectResponse.proposedAction}</span></div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Reason (audit trail)</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Enter reason for operation..."
                      className="w-full bg-scada-bg border border-scada-border rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                {selectResponse && !result ? (
                  <>
                    <button onClick={handleExecute} disabled={loading}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded text-sm">
                      {loading ? 'Executing...' : 'CONFIRM EXECUTE'}
                    </button>
                    <button onClick={handleCancel} className="flex-1 py-2 bg-scada-border hover:bg-gray-600 text-white rounded text-sm">
                      CANCEL
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setShowConfirm(false); reset(); }}
                    className="flex-1 py-2 bg-scada-border hover:bg-gray-600 text-white rounded text-sm">
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────── Tap Changer Control ───────────────────

function TapControl({ prefix, label, equipmentId }: { prefix: string; label: string; equipmentId: string }) {
  const tapPos = useNumericValue(`${prefix}_TAP_POS`, 0);
  const voltage = useNumericValue(`${prefix}_V_LV`, 2);
  const { loading, select, reset } = useControl();

  const handleRaise = () => {
    reset();
    select(equipmentId, 'RAISE' as CommandType);
  };
  const handleLower = () => {
    reset();
    select(equipmentId, 'LOWER' as CommandType);
  };

  return (
    <div className="border border-scada-border rounded-lg p-4">
      <div className="text-sm font-medium mb-3">{label}</div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-xs text-gray-400">Current Tap</div>
          <div className="text-3xl font-mono font-bold text-scada-accent">{tapPos}</div>
          <div className="text-xs text-gray-400 mt-1">LV: {voltage} kV</div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleRaise}
            disabled={loading || parseInt(tapPos) >= 9}
            className="px-4 py-2 bg-scada-accent/20 hover:bg-scada-accent/40 disabled:opacity-30 rounded flex items-center gap-1 text-sm"
          >
            <ChevronUp className="w-4 h-4" /> RAISE
          </button>
          <button
            onClick={handleLower}
            disabled={loading || parseInt(tapPos) <= 1}
            className="px-4 py-2 bg-scada-accent/20 hover:bg-scada-accent/40 disabled:opacity-30 rounded flex items-center gap-1 text-sm"
          >
            <ChevronDown className="w-4 h-4" /> LOWER
          </button>
        </div>
        {/* Tap position visual */}
        <div className="flex flex-col items-center gap-0.5">
          {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((pos) => (
            <div
              key={pos}
              className={`w-3 h-2 rounded-sm ${parseInt(tapPos) === pos ? 'bg-scada-accent' : 'bg-scada-border'}`}
              title={`Tap ${pos}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Helpers ───────────────────

function CommandStateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    EXECUTE_SUCCESS: 'bg-green-900/50 text-green-400',
    EXECUTE_FAILED: 'bg-red-900/50 text-red-400',
    SELECT_CONFIRMED: 'bg-yellow-900/50 text-yellow-400',
    CANCELLED: 'bg-gray-700 text-gray-400',
    TIMEOUT: 'bg-orange-900/50 text-orange-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[state] || 'bg-gray-700 text-gray-400'}`}>
      {state}
    </span>
  );
}
