import { useSimulationContext } from './DemoSimulationContext';
import { Bell, Check, X } from 'lucide-react';

export default function DemoAlarmPanel() {
  const { alarms, acknowledgeAlarm, clearAlarm } = useSimulationContext();

  if (alarms.length === 0) return null;

  const unackCount = alarms.filter((a) => !a.acknowledged).length;

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10">
      <div className="flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-100">
        <div className="flex items-center gap-2">
          <Bell className={`w-4 h-4 text-red-600 ${unackCount > 0 ? 'alarm-flash' : ''}`} />
          <span className="text-sm font-semibold text-red-800">
            Alarms ({unackCount} active)
          </span>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
        {alarms.slice(0, 10).map((alarm) => (
          <div
            key={alarm.id}
            className={`px-3 py-2 text-xs ${alarm.acknowledged ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{alarm.equipment}</div>
                <div className="text-gray-600 truncate">{alarm.message}</div>
                <div className="text-gray-400 mt-0.5">
                  {alarm.timestamp.toLocaleTimeString()}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!alarm.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlarm(alarm.id)}
                    className="p-1 rounded hover:bg-green-50 text-green-600"
                    title="Acknowledge"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => clearAlarm(alarm.id)}
                  className="p-1 rounded hover:bg-red-50 text-red-400"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
