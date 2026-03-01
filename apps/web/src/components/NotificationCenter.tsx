import { useState, useEffect, useCallback, useRef } from 'react';
import { useAlarmStore } from '@/stores/alarmStore';
import { Bell, X, Volume2, VolumeX, Check } from 'lucide-react';
import type { ActiveAlarm } from '@gridvision/shared';

interface Notification {
  id: string;
  message: string;
  priority: number;
  timestamp: Date;
  read: boolean;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const soundEnabled = useAlarmStore((s) => s.soundEnabled);
  const toggleSound = useAlarmStore((s) => s.toggleSound);
  const activeAlarms = useAlarmStore((s) => s.activeAlarms);
  const prevAlarmsRef = useRef<string[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setBrowserPermission(perm);
        });
      }
    }
  }, []);

  // Watch for new alarms and create notifications
  useEffect(() => {
    const currentIds = activeAlarms.map((a) => a.id);
    const prevIds = prevAlarmsRef.current;

    const newAlarms = activeAlarms.filter((a) => !prevIds.includes(a.id));
    prevAlarmsRef.current = currentIds;

    for (const alarm of newAlarms) {
      const notif: Notification = {
        id: alarm.id,
        message: alarm.message || `Alarm: ${alarm.tag || 'Unknown'}`,
        priority: alarm.priority,
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      showToast(notif);

      // Browser notification
      if (browserPermission === 'granted') {
        const priorityLabel = alarm.priority === 1 ? 'EMERGENCY' : alarm.priority === 2 ? 'URGENT' : 'ALARM';
        try {
          new window.Notification(`GridVision ${priorityLabel}`, {
            body: notif.message,
            tag: alarm.id,
            requireInteraction: alarm.priority <= 2,
          });
        } catch { /* ignore */ }
      }

      // Sound alert
      if (soundEnabled) {
        playAlarmSound(alarm.priority);
      }
    }
  }, [activeAlarms, browserPermission, soundEnabled]);

  const showToast = useCallback((notif: Notification) => {
    setToasts((prev) => [...prev, notif]);
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== notif.id));
    }, 5000);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Notification Bell */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded hover:bg-scada-border/50 text-gray-400 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className="p-1.5 rounded hover:bg-scada-border/50 text-gray-400 hover:text-white transition-colors"
        title={soundEnabled ? 'Mute alarms' : 'Enable alarm sounds'}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {/* Notification Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 max-h-96 bg-scada-panel border border-scada-border rounded-lg shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-scada-border">
              <span className="text-sm font-medium">Notifications</span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-scada-accent hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-3 py-2 border-b border-scada-border/50 hover:bg-scada-bg/50 cursor-pointer ${!n.read ? 'bg-scada-accent/5' : ''}`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getPriorityColor(n.priority)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate">{n.message}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {n.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                        </div>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-scada-accent mt-2" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-14 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 p-3 rounded-lg shadow-lg border max-w-sm animate-count-up ${getToastStyle(t.priority)}`}
          >
            <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${getPriorityColor(t.priority)}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{getPriorityLabel(t.priority)}</div>
              <div className="text-xs text-gray-300 truncate">{t.message}</div>
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-gray-400 hover:text-white shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────── Helpers ───────────────────

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1: return 'bg-red-500';
    case 2: return 'bg-orange-500';
    case 3: return 'bg-yellow-500';
    default: return 'bg-blue-500';
  }
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return 'EMERGENCY';
    case 2: return 'URGENT';
    case 3: return 'ALARM';
    default: return 'INFO';
  }
}

function getToastStyle(priority: number): string {
  switch (priority) {
    case 1: return 'bg-red-900/90 border-red-700';
    case 2: return 'bg-orange-900/90 border-orange-700';
    case 3: return 'bg-yellow-900/90 border-yellow-700';
    default: return 'bg-blue-900/90 border-blue-700';
  }
}

function playAlarmSound(priority: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Different tones for priority levels
    const freq = priority === 1 ? 880 : priority === 2 ? 660 : priority === 3 ? 440 : 330;
    const duration = priority <= 2 ? 0.3 : 0.15;

    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);

    // Play a second beep for critical alarms
    if (priority <= 2) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = freq * 1.2;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + duration + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration + 0.1 + duration);
      osc2.start(ctx.currentTime + duration + 0.1);
      osc2.stop(ctx.currentTime + duration + 0.1 + duration);
    }
  } catch {
    // Audio not available
  }
}
