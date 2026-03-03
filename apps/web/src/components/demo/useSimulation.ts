import React, { useState, useEffect, useCallback, useRef } from 'react';

export type CBState = 'OPEN' | 'CLOSED' | 'TRIPPED';

export interface SimulatedAlarm {
  id: string;
  timestamp: Date;
  equipment: string;
  message: string;
  priority: 1 | 2 | 3;
  acknowledged: boolean;
}

export interface EnergizationState {
  '33kV_Bus_Section_1': boolean;
  '33kV_Bus_Section_2': boolean;
  '11kV_Bus_Section_1': boolean;
  '11kV_Bus_Section_2': boolean;
  feeders: Record<string, boolean>;
  connectionLines: Record<string, boolean>;
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
  // Energization state
  energizationState: EnergizationState;
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

  // Calculate energization state based on circuit breaker and isolator positions
  const energizationState = React.useMemo<EnergizationState>(() => {
    // 33kV Bus Section 1: Energized if INC1_CB is CLOSED
    const bus33_1 = cbStates.INC1_CB === 'CLOSED';
    
    // 33kV Bus Section 2: Energized if 33kV Bus 1 is energized AND BSC_CB is CLOSED
    const bus33_2 = bus33_1 && cbStates.BSC_CB === 'CLOSED';
    
    // 11kV Bus Section 1: Energized if 33kV Bus 1 → TR1_HV_CB → TR1_LV_CB path is complete
    const bus11_1 = bus33_1 && cbStates.TR1_HV_CB === 'CLOSED' && cbStates.TR1_LV_CB === 'CLOSED';
    
    // 11kV Bus Section 2: Energized through TR2 OR through bus coupler from Bus Section 1
    const bus11_2_via_tr2 = bus33_2 && cbStates.TR2_HV_CB === 'CLOSED' && cbStates.TR2_LV_CB === 'CLOSED';
    const bus11_2_via_coupler = bus11_1 && cbStates.BC_CB === 'CLOSED';
    const bus11_2 = bus11_2_via_tr2 || bus11_2_via_coupler;
    
    // Feeder energization
    const feeders: Record<string, boolean> = {};
    for (let i = 1; i <= 6; i++) {
      const fdrNum = String(i).padStart(2, '0');
      const fdrTag = `FDR${fdrNum}_CB`;
      // Feeders 1-3 are on Bus Section 1, Feeders 4-6 are on Bus Section 2
      const busEnergized = i <= 3 ? bus11_1 : bus11_2;
      feeders[fdrTag] = busEnergized && cbStates[fdrTag] === 'CLOSED';
    }
    
    // Connection lines energization - must also consider isolator states
    const connectionLines: Record<string, boolean> = {
      // 33kV incomer line (always red - it's the grid source)
      '33kV_incomer': true,
      // Line from INC1_ISO to INC1_CB - consider isolator state
      'INC1_ISO_to_CB': isolatorStates.INC1_ISO === true,
      // Line from INC1_CB to 33kV Bus
      'INC1_CB_to_bus': cbStates.INC1_CB === 'CLOSED',
      // Line from 33kV Bus to TR1_HV_ISO
      'bus33_to_TR1_HV_ISO': bus33_1,
      // Line from TR1_HV_ISO to TR1_HV_CB - consider isolator state  
      'TR1_HV_ISO_to_CB': bus33_1 && isolatorStates.TR1_HV_ISO === true,
      // Line from TR1_HV_CB to transformer HV
      'TR1_HV_CB_to_transformer': bus33_1 && isolatorStates.TR1_HV_ISO === true && cbStates.TR1_HV_CB === 'CLOSED',
      // Line from transformer LV to TR1_LV_ISO  
      'TR1_transformer_to_LV_ISO': bus33_1 && isolatorStates.TR1_HV_ISO === true && cbStates.TR1_HV_CB === 'CLOSED',
      // Line from TR1_LV_ISO to TR1_LV_CB - consider isolator state
      'TR1_LV_ISO_to_CB': bus33_1 && isolatorStates.TR1_HV_ISO === true && cbStates.TR1_HV_CB === 'CLOSED' && isolatorStates.TR1_LV_ISO === true,
      // Line from TR1_LV_CB to 11kV Bus
      'TR1_LV_CB_to_bus': bus11_1,
      // Line from 33kV Bus to TR2_HV_ISO
      'bus33_to_TR2_HV_ISO': bus33_2,
      // Line from TR2_HV_ISO to TR2_HV_CB - consider isolator state
      'TR2_HV_ISO_to_CB': bus33_2 && isolatorStates.TR2_HV_ISO === true,
      // Line from TR2_HV_CB to transformer HV
      'TR2_HV_CB_to_transformer': bus33_2 && isolatorStates.TR2_HV_ISO === true && cbStates.TR2_HV_CB === 'CLOSED',
      // Line from transformer LV to TR2_LV_ISO
      'TR2_transformer_to_LV_ISO': bus33_2 && isolatorStates.TR2_HV_ISO === true && cbStates.TR2_HV_CB === 'CLOSED',
      // Line from TR2_LV_ISO to TR2_LV_CB - consider isolator state
      'TR2_LV_ISO_to_CB': bus33_2 && isolatorStates.TR2_HV_ISO === true && cbStates.TR2_HV_CB === 'CLOSED' && isolatorStates.TR2_LV_ISO === true,
      // Line from TR2_LV_CB to 11kV Bus  
      'TR2_LV_CB_to_bus': bus11_2_via_tr2,
      // 33kV bus coupler lines
      'BSC_line_left': bus33_1,
      'BSC_line_right': bus33_2,
      // 11kV bus coupler lines
      'BC_line_left': bus11_1,
      'BC_line_right': bus11_2,
      // Individual feeder lines
      'FDR01_line': feeders['FDR01_CB'],
      'FDR02_line': feeders['FDR02_CB'],
      'FDR03_line': feeders['FDR03_CB'],
      'FDR04_line': feeders['FDR04_CB'],
      'FDR05_line': feeders['FDR05_CB'],
      'FDR06_line': feeders['FDR06_CB'],
    };
    
    return {
      '33kV_Bus_Section_1': bus33_1,
      '33kV_Bus_Section_2': bus33_2,
      '11kV_Bus_Section_1': bus11_1,
      '11kV_Bus_Section_2': bus11_2,
      feeders,
      connectionLines,
    };
  }, [cbStates, isolatorStates]);

  // Initialize and update measurements every 2 seconds
  useEffect(() => {
    function generateMeasurements() {
      const m: Record<string, number> = {};
      const currentCBStates = cbStatesRef.current;
      
      // Calculate energization state for measurements
      const bus33_1 = currentCBStates.INC1_CB === 'CLOSED';
      const bus33_2 = bus33_1 && currentCBStates.BSC_CB === 'CLOSED';
      const bus11_1 = bus33_1 && currentCBStates.TR1_HV_CB === 'CLOSED' && currentCBStates.TR1_LV_CB === 'CLOSED';
      const bus11_2_via_tr2 = bus33_2 && currentCBStates.TR2_HV_CB === 'CLOSED' && currentCBStates.TR2_LV_CB === 'CLOSED';
      const bus11_2_via_coupler = bus11_1 && currentCBStates.BC_CB === 'CLOSED';
      const bus11_2 = bus11_2_via_tr2 || bus11_2_via_coupler;
      
      // 33kV incoming measurements - voltage exists upstream even when CB open, but current/power are 0 when open
      m['INC1_V'] = randomBetween(32.5, 33.5); // Voltage always present (grid source)
      if (currentCBStates.INC1_CB === 'CLOSED') {
        m['INC1_I'] = randomBetween(120, 180);
        m['INC1_P'] = randomBetween(5.5, 7.5);
      } else {
        m['INC1_I'] = 0;
        m['INC1_P'] = 0;
      }

      // Transformer 1 HV measurements - only if 33kV Bus Section 1 energized AND TR1_HV_CB closed
      const tr1_hv_energized = bus33_1 && currentCBStates.TR1_HV_CB === 'CLOSED';
      if (tr1_hv_energized) {
        m['TR1_V_HV'] = randomBetween(32.8, 33.2);
        m['TR1_I_HV'] = randomBetween(80, 140);
        m['TR1_P'] = randomBetween(3.0, 4.5);
        m['TR1_OIL_TEMP'] = randomBetween(55, 72);
      } else {
        m['TR1_V_HV'] = 0;
        m['TR1_I_HV'] = 0;
        m['TR1_P'] = 0;
        // Oil temperature decays slowly toward ambient when de-energized
        const currentTemp = measurements['TR1_OIL_TEMP'] || 25;
        m['TR1_OIL_TEMP'] = Math.max(25, currentTemp - (currentTemp - 25) * 0.1); // Decay toward 25°C ambient
      }

      // TR1 LV voltage - only if full TR1 path is complete
      if (bus11_1) {
        m['TR1_V_LV'] = randomBetween(10.8, 11.2);
      } else {
        m['TR1_V_LV'] = 0;
      }

      // Transformer 2 HV measurements - only if 33kV Bus Section 2 energized AND TR2_HV_CB closed
      const tr2_hv_energized = bus33_2 && currentCBStates.TR2_HV_CB === 'CLOSED';
      if (tr2_hv_energized) {
        m['TR2_V_HV'] = randomBetween(32.8, 33.2);
        m['TR2_I_HV'] = randomBetween(80, 140);
        m['TR2_P'] = randomBetween(3.0, 4.5);
        m['TR2_OIL_TEMP'] = randomBetween(55, 72);
      } else {
        m['TR2_V_HV'] = 0;
        m['TR2_I_HV'] = 0;
        m['TR2_P'] = 0;
        // Oil temperature decays slowly toward ambient when de-energized
        const currentTemp = measurements['TR2_OIL_TEMP'] || 25;
        m['TR2_OIL_TEMP'] = Math.max(25, currentTemp - (currentTemp - 25) * 0.1); // Decay toward 25°C ambient
      }

      // TR2 LV voltage - only if full TR2 path is complete
      if (bus11_2_via_tr2) {
        m['TR2_V_LV'] = randomBetween(10.8, 11.2);
      } else {
        m['TR2_V_LV'] = 0;
      }

      // 11kV bus voltage - only if either bus section is energized
      if (bus11_1 || bus11_2) {
        m['BUS_11KV_V'] = randomBetween(10.9, 11.1);
      } else {
        m['BUS_11KV_V'] = 0;
      }

      // Feeders - respect CB state AND bus energization
      for (let i = 1; i <= 6; i++) {
        const fdr = String(i).padStart(2, '0');
        const fdrCB = `FDR${fdr}_CB`;
        const fdrCBClosed = currentCBStates[fdrCB] === 'CLOSED';
        
        // Feeders 1-3 are on Bus Section 1, Feeders 4-6 are on Bus Section 2
        const busEnergized = i <= 3 ? bus11_1 : bus11_2;
        const feederEnergized = fdrCBClosed && busEnergized;
        
        if (feederEnergized) {
          m[`FDR${fdr}_I`] = randomBetween(40, 180);
          m[`FDR${fdr}_P`] = randomBetween(0.5, 2.5);
          m[`FDR${fdr}_V`] = randomBetween(10.9, 11.1);
        } else {
          m[`FDR${fdr}_I`] = 0;
          m[`FDR${fdr}_P`] = 0;
          m[`FDR${fdr}_V`] = busEnergized ? randomBetween(10.9, 11.1) : 0; // Voltage present if bus energized even if feeder CB open
        }
      }

      setMeasurements(m);
    }

    generateMeasurements();
    const interval = setInterval(generateMeasurements, 2000);
    return () => clearInterval(interval);
  }, [measurements]);

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
    energizationState,
    toggleCB,
    toggleIsolator,
    acknowledgeAlarm,
    clearAlarm,
    selectedEquipment,
    setSelectedEquipment,
  };
}
