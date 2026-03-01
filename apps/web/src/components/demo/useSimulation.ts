import { useState, useEffect, useCallback, useRef } from 'react';

export type CBState = 'OPEN' | 'CLOSED' | 'TRIPPED';

export interface SimulatedAlarm {
  id: string;
  timestamp: Date;
  equipment: string;
  message: string;
  priority: 1 | 2 | 3;
  acknowledged: boolean;
}

export interface SimulationState {
  // Circuit breaker states
  cbStates: Record<string, CBState>;
  // Isolator states (true = closed)
  isolatorStates: Record<string, boolean>;
  // Earth switch states (true = closed)
  earthSwitchStates: Record<string, boolean>;
  // Measurements: voltage (kV), current (A), power (MW), temperature (°C)
  measurements: Record<string, number>;
  // Alarms
  alarms: SimulatedAlarm[];
  // Actions
  toggleCB: (tag: string) => void;
  toggleIsolator: (tag: string) => void;
  acknowledgeAlarm: (id: string) => void;
  clearAlarm: (id: string) => void;
  selectedEquipment: string | null;
  setSelectedEquipment: (id: string | null) => void;
}

const CB_TAGS = [
  'INC1_CB', 'BSC_CB', 'TR1_HV_CB', 'TR1_LV_CB',
  'TR2_HV_CB', 'TR2_LV_CB', 'BC_CB',
  'FDR01_CB', 'FDR02_CB', 'FDR03_CB', 'FDR04_CB', 'FDR05_CB', 'FDR06_CB',
];

const ISOLATOR_TAGS = [
  'INC1_ISO', 'TR1_HV_ISO', 'TR1_LV_ISO', 'TR2_HV_ISO', 'TR2_LV_ISO',
];

const EARTH_SWITCH_TAGS = [
  'INC1_ES', 'TR1_ES', 'TR2_ES',
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

let alarmIdCounter = 0;

export function useSimulation(): SimulationState {
  const [cbStates, setCBStates] = useState<Record<string, CBState>>(() => {
    const initial: Record<string, CBState> = {};
    CB_TAGS.forEach((tag) => { initial[tag] = 'CLOSED'; });
    return initial;
  });

  const [isolatorStates, setIsolatorStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ISOLATOR_TAGS.forEach((tag) => { initial[tag] = true; });
    return initial;
  });

  const [earthSwitchStates, setEarthSwitchStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    EARTH_SWITCH_TAGS.forEach((tag) => { initial[tag] = false; });
    return initial;
  });

  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [alarms, setAlarms] = useState<SimulatedAlarm[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const cbStatesRef = useRef(cbStates);
  cbStatesRef.current = cbStates;

  // Initialize and update measurements every 2 seconds
  useEffect(() => {
    function generateMeasurements() {
      const m: Record<string, number> = {};

      // 33kV incoming
      m['INC1_V'] = randomBetween(32.5, 33.5);
      m['INC1_I'] = randomBetween(120, 180);
      m['INC1_P'] = randomBetween(5.5, 7.5);

      // Transformer 1
      m['TR1_V_HV'] = randomBetween(32.8, 33.2);
      m['TR1_I_HV'] = randomBetween(80, 140);
      m['TR1_P'] = randomBetween(3.0, 4.5);
      m['TR1_OIL_TEMP'] = randomBetween(55, 72);
      m['TR1_V_LV'] = randomBetween(10.8, 11.2);

      // Transformer 2
      m['TR2_V_HV'] = randomBetween(32.8, 33.2);
      m['TR2_I_HV'] = randomBetween(80, 140);
      m['TR2_P'] = randomBetween(3.0, 4.5);
      m['TR2_OIL_TEMP'] = randomBetween(55, 72);
      m['TR2_V_LV'] = randomBetween(10.8, 11.2);

      // 11kV bus voltage
      m['BUS_11KV_V'] = randomBetween(10.9, 11.1);

      // Feeders
      for (let i = 1; i <= 6; i++) {
        const fdr = String(i).padStart(2, '0');
        const isClosed = cbStatesRef.current[`FDR${fdr}_CB`] === 'CLOSED';
        m[`FDR${fdr}_I`] = isClosed ? randomBetween(40, 180) : 0;
        m[`FDR${fdr}_P`] = isClosed ? randomBetween(0.5, 2.5) : 0;
        m[`FDR${fdr}_V`] = randomBetween(10.9, 11.1);
      }

      setMeasurements(m);
    }

    generateMeasurements();
    const interval = setInterval(generateMeasurements, 2000);
    return () => clearInterval(interval);
  }, []);

  // Random feeder trips every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const feederIndex = Math.floor(Math.random() * 6) + 1;
      const fdr = String(feederIndex).padStart(2, '0');
      const tag = `FDR${fdr}_CB`;

      if (cbStatesRef.current[tag] === 'CLOSED') {
        setCBStates((prev) => ({ ...prev, [tag]: 'TRIPPED' }));
        const newAlarm: SimulatedAlarm = {
          id: `alarm-${++alarmIdCounter}`,
          timestamp: new Date(),
          equipment: `Feeder ${feederIndex}`,
          message: `FDR${fdr} CB tripped — overcurrent protection operated`,
          priority: 1,
          acknowledged: false,
        };
        setAlarms((prev) => [newAlarm, ...prev]);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleCB = useCallback((tag: string) => {
    setCBStates((prev) => {
      const current = prev[tag];
      const next: CBState = current === 'CLOSED' ? 'OPEN' : 'CLOSED';
      return { ...prev, [tag]: next };
    });
  }, []);

  const toggleIsolator = useCallback((tag: string) => {
    setIsolatorStates((prev) => ({ ...prev, [tag]: !prev[tag] }));
  }, []);

  const acknowledgeAlarm = useCallback((id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    );
  }, []);

  const clearAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    cbStates,
    isolatorStates,
    earthSwitchStates,
    measurements,
    alarms,
    toggleCB,
    toggleIsolator,
    acknowledgeAlarm,
    clearAlarm,
    selectedEquipment,
    setSelectedEquipment,
  };
}
