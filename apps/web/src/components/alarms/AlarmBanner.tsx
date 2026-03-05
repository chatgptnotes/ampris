import { useState } from 'react';
import { CheckCheck, Bell } from 'lucide-react';
import { useAlarmStore } from '@/stores/alarmStore';
import { ALARM_PRIORITIES } from '@gridvision/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AlarmBanner() {
  const { activeAlarms, acknowledgeAlarm } = useAlarmStore();
  const [acking, setAcking] = useState<string | null>(null);

  // Show first unacknowledged alarm, fall back to first active
  const latestAlarm =
    activeAlarms.find((a) => a.state === 'RAISED') ?? activeAlarms[0];

  if (!latestAlarm) return null;

  const config = ALARM_PRIORITIES[latestAlarm.priority];
  const isAcked = latestAlarm.state === 'ACKNOWLEDGED';
  const unackedCount = activeAlarms.filter((a) => a.state === 'RAISED').length;

  const handleAck = async () => {
    setAcking(latestAlarm.id);
    try {
      // Optimistic update
      acknowledgeAlarm(latestAlarm.id);
      // Persist to backend
      await fetch(`${API_BASE}/api/alarms/${latestAlarm.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to acknowledge alarm:', err);
    } finally {
      setAcking(null);
    }
  };

  return (
    <div
      className={`px-4 py-2 text-sm font-medium flex items-center gap-3 ${!isAcked ? 'alarm-flash' : ''}`}
      style={{
        backgroundColor: `${config.color}20`,
        borderBottom: `2px solid ${config.color}`,
      }}
    >
      {/* Indicator dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color }}
      />

      {/* Message */}
      <span className="font-mono flex-1">{latestAlarm.message}</span>

      {/* Tag */}
      <span className="text-xs text-gray-400">{latestAlarm.tag}</span>

      {/* Unacked count badge */}
      {unackedCount > 1 && (
        <span
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: `${config.color}30`, color: config.color }}
        >
          <Bell className="w-3 h-3" />
          {unackedCount} active
        </span>
      )}

      {/* Acknowledge button / Acked badge */}
      {isAcked ? (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
          <CheckCheck className="w-3 h-3" /> Ack'd
        </span>
      ) : (
        <button
          onClick={handleAck}
          disabled={acking === latestAlarm.id}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-50"
          style={{
            borderColor: config.color,
            color: config.color,
            backgroundColor: 'white',
          }}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {acking === latestAlarm.id ? 'Acking...' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}
