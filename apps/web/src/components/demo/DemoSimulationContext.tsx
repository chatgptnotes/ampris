import { createContext, useContext, type ReactNode } from 'react';
import { useSimulation, type SimulationState } from './useSimulation';

const SimulationContext = createContext<SimulationState | null>(null);

export function useSimulationContext(): SimulationState {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulationContext must be used within DemoSimulationProvider');
  return ctx;
}

export function DemoSimulationProvider({ children }: { children: ReactNode }) {
  const simulation = useSimulation();
  return (
    <SimulationContext.Provider value={simulation}>
      {children}
    </SimulationContext.Provider>
  );
}
