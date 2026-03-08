import { useEffect, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/services/websocket';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { useAlarmStore } from '@/stores/alarmStore';
import { useAuthStore } from '@/stores/authStore';
import type { RealTimeValue } from '@gridvision/shared';

/** Global event emitter for SCADA WebSocket events that pages can subscribe to */
type ScadaEventHandler = (data: unknown) => void;
const scadaListeners = new Map<string, Set<ScadaEventHandler>>();

export function onScadaEvent(event: string, handler: ScadaEventHandler): () => void {
  if (!scadaListeners.has(event)) scadaListeners.set(event, new Set());
  scadaListeners.get(event)!.add(handler);
  return () => { scadaListeners.get(event)?.delete(handler); };
}

function emitScadaEvent(event: string, data: unknown): void {
  scadaListeners.get(event)?.forEach((handler) => handler(data));
}

export function useWebSocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateValue = useRealtimeStore((s) => s.updateValue);
  const batchUpdateValues = useRealtimeStore((s) => s.batchUpdateValues);
  const setValues = useRealtimeStore((s) => s.setValues);
  const setConnectionStatus = useRealtimeStore((s) => s.setConnectionStatus);
  const addAlarm = useAlarmStore((s) => s.addAlarm);
  const removeAlarm = useAlarmStore((s) => s.removeAlarm);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);
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
      // Only update if status actually changed — avoids rapid re-renders on every retry
      setConnectionStatus((prev: string) => prev === 'connecting' ? prev : 'connecting');
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

    // Tag value changes (from tag engine)
    socket.on('tag:valueChanged', (data: { tag: string; value: any; timestamp: string }) => {
      updateValue({ tag: data.tag, value: data.value, quality: 0, timestamp: new Date(data.timestamp) });
    });

    // ─── Alarm events ───
    socket.on('alarm:raised', (data: unknown) => {
      addAlarm(data as Parameters<typeof addAlarm>[0]);
    });

    socket.on('alarm:cleared', (data: { id: string }) => {
      removeAlarm(data.id);
    });

    socket.on('alarm:acknowledged', (data: { id: string }) => {
      updateAlarm(data.id, { acknowledged: true, acknowledgedAt: new Date() } as any);
      emitScadaEvent('alarm:acknowledged', data);
    });

    socket.on('alarm:shelved', (data: { id: string }) => {
      removeAlarm(data.id);
      emitScadaEvent('alarm:shelved', data);
    });

    socket.on('alarm:bulk-ack', (data: unknown) => {
      emitScadaEvent('alarm:bulk-ack', data);
    });

    // ─── Command sequence events ───
    socket.on('command:started', (data: unknown) => {
      emitScadaEvent('command:started', data);
    });

    socket.on('command:failed', (data: unknown) => {
      emitScadaEvent('command:failed', data);
    });

    socket.on('command:waitingConfirm', (data: unknown) => {
      emitScadaEvent('command:waitingConfirm', data);
    });

    socket.on('command:stepComplete', (data: unknown) => {
      emitScadaEvent('command:stepComplete', data);
    });

    socket.on('command:completed', (data: unknown) => {
      emitScadaEvent('command:completed', data);
    });

    // ─── Redundancy events ───
    socket.on('redundancy:heartbeat', (data: unknown) => {
      emitScadaEvent('redundancy:heartbeat', data);
    });

    socket.on('redundancy:failover', (data: unknown) => {
      emitScadaEvent('redundancy:failover', data);
    });

    socket.on('redundancy:switchback', (data: unknown) => {
      emitScadaEvent('redundancy:switchback', data);
    });

    // ─── Interlock events ───
    socket.on('interlock:blocked', (data: unknown) => {
      emitScadaEvent('interlock:blocked', data);
    });

    // ─── SBO (Select-Before-Operate) events ───
    socket.on('sbo:timeout', (data: unknown) => {
      emitScadaEvent('sbo:timeout', data);
    });

    socket.on('sbo:selected', (data: unknown) => {
      emitScadaEvent('sbo:selected', data);
    });

    socket.on('sbo:operated', (data: unknown) => {
      emitScadaEvent('sbo:operated', data);
    });

    socket.on('sbo:cancelled', (data: unknown) => {
      emitScadaEvent('sbo:cancelled', data);
    });

    return () => {
      initialized.current = false;
      disconnectSocket();
    };
  }, [isAuthenticated, updateValue, batchUpdateValues, setValues, setConnectionStatus, addAlarm, removeAlarm, updateAlarm]);
}
