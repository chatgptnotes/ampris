import { useEffect, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/services/websocket';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { useAlarmStore } from '@/stores/alarmStore';
import { useAuthStore } from '@/stores/authStore';
import type { RealTimeValue } from '@gridvision/shared';

export function useWebSocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateValue = useRealtimeStore((s) => s.updateValue);
  const batchUpdateValues = useRealtimeStore((s) => s.batchUpdateValues);
  const setValues = useRealtimeStore((s) => s.setValues);
  const setConnectionStatus = useRealtimeStore((s) => s.setConnectionStatus);
  const addAlarm = useAlarmStore((s) => s.addAlarm);
  const removeAlarm = useAlarmStore((s) => s.removeAlarm);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setConnectionStatus('disconnected');
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    connectSocket();
    const socket = getSocket();

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('connecting');
    });

    socket.on('snapshot', (data: Record<string, RealTimeValue>) => {
      setValues(data);
    });

    // Individual updates (legacy)
    socket.on('measurement', (data: RealTimeValue) => {
      updateValue(data);
    });

    socket.on('digital_state', (data: RealTimeValue) => {
      updateValue(data);
    });

    // Batched updates from enhanced server (250ms batches)
    socket.on('measurements:batch', (data: RealTimeValue[]) => {
      batchUpdateValues(data);
    });

    socket.on('digitals:batch', (data: RealTimeValue[]) => {
      batchUpdateValues(data);
    });

    // Alarms
    socket.on('alarm:raised', (data: unknown) => {
      addAlarm(data as Parameters<typeof addAlarm>[0]);
    });

    socket.on('alarm:cleared', (data: { id: string }) => {
      removeAlarm(data.id);
    });

    return () => {
      initialized.current = false;
      disconnectSocket();
    };
  }, [isAuthenticated, updateValue, batchUpdateValues, setValues, setConnectionStatus, addAlarm, removeAlarm]);
}
