import { create } from 'zustand';
import type { RealTimeValue } from '@gridvision/shared';

interface RealtimeState {
  values: Record<string, RealTimeValue>;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';

  setValues: (values: Record<string, RealTimeValue>) => void;
  updateValue: (value: RealTimeValue) => void;
  batchUpdateValues: (values: RealTimeValue[]) => void;
  setConnectionStatus: (status: RealtimeState['connectionStatus']) => void;
  getValue: (tag: string) => RealTimeValue | undefined;
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  values: {},
  connectionStatus: 'disconnected',

  setValues: (values) => set({ values }),

  updateValue: (value) =>
    set((state) => ({
      values: { ...state.values, [value.tag]: value },
    })),

  batchUpdateValues: (values) =>
    set((state) => {
      const updated = { ...state.values };
      for (const v of values) {
        updated[v.tag] = v;
      }
      return { values: updated };
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  getValue: (tag) => get().values[tag],
}));
