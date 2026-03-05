import { create } from 'zustand';
import type { ActiveAlarm, AlarmSummary } from '@gridvision/shared';

interface AlarmState {
  activeAlarms: ActiveAlarm[];
  summary: AlarmSummary;
  soundEnabled: boolean;

  setActiveAlarms: (alarms: ActiveAlarm[]) => void;
  addAlarm: (alarm: ActiveAlarm) => void;
  removeAlarm: (id: string) => void;
  updateAlarm: (id: string, updates: Partial<ActiveAlarm>) => void;
  acknowledgeAlarm: (id: string) => void;
  setSummary: (summary: AlarmSummary) => void;
  toggleSound: () => void;
}

export const useAlarmStore = create<AlarmState>()((set) => ({
  activeAlarms: [],
  summary: { emergency: 0, urgent: 0, normal: 0, info: 0, total: 0, unacknowledged: 0 },
  soundEnabled: true,

  setActiveAlarms: (alarms) => set({ activeAlarms: alarms }),

  addAlarm: (alarm) =>
    set((state) => ({
      activeAlarms: [alarm, ...state.activeAlarms],
      summary: {
        ...state.summary,
        total: state.summary.total + 1,
        unacknowledged: state.summary.unacknowledged + 1,
      },
    })),

  removeAlarm: (id) =>
    set((state) => ({
      activeAlarms: state.activeAlarms.filter((a) => a.id !== id),
    })),

  updateAlarm: (id, updates) =>
    set((state) => ({
      activeAlarms: state.activeAlarms.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    })),

  acknowledgeAlarm: (id) =>
    set((state) => ({
      activeAlarms: state.activeAlarms.map((a) =>
        a.id === id ? { ...a, state: 'ACKNOWLEDGED', ackedAt: new Date() } : a,
      ),
      summary: {
        ...state.summary,
        unacknowledged: Math.max(0, state.summary.unacknowledged - 1),
      },
    })),

  setSummary: (summary) => set({ summary }),

  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
