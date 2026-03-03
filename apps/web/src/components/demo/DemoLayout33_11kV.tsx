import BusBar from '../sld/equipment/BusBar';
import PowerTransformer from '../sld/equipment/PowerTransformer';
import FeederLine from '../sld/equipment/FeederLine';
import LightningArrester from '../sld/equipment/LightningArrester';
import DemoCircuitBreaker from './DemoCircuitBreaker';
import DemoIsolator from './DemoIsolator';
import DemoEarthSwitch from './DemoEarthSwitch';
import DemoMeasurementLabel from './DemoMeasurementLabel';
import DemoAlarmBadge from './DemoAlarmBadge';
import { useSimulationContext } from './DemoSimulationContext';

// Define colors for energization states
const ENERGIZED_COLOR = '#DC2626'; // Red - ALL energized equipment
const DE_ENERGIZED_COLOR = '#16A34A'; // Green - ALL de-energized equipment

// Component for colored connection lines
function ConnectionLine({ x1, y1, x2, y2, energized, voltageLevel }: {
  x1: number; y1: number; x2: number; y2: number; energized: boolean; voltageLevel: 33 | 11;
}) {
  const color = energized 
    ? ENERGIZED_COLOR
    : DE_ENERGIZED_COLOR;
  
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />;
}

export default function DemoLayout33_11kV() {
  const simulation = useSimulationContext();
  const { energizationState } = simulation;
  
  const bus33Y = 150;
  const bus11Y = 450;

  return (
    <g className="demo-light-theme">
      {/* Title */}
      <text x={600} y={30} textAnchor="middle" className="text-sm font-semibold" fill="#1E293B">
        DEMO — 33/11 kV Distribution Substation SLD
      </text>
      <text x={600} y={48} textAnchor="middle" className="text-[10px]" fill="#64748B">
        Click circuit breakers to toggle | Measurements update every 2s | Random trips every 15s
      </text>

      {/* 33kV Incoming Line - always red (grid source) */}
      <ConnectionLine x1={300} y1={55} x2={300} y2={bus33Y - 58} energized={energizationState.connectionLines['33kV_incomer']} voltageLevel={33} />
      <text x={300} y={60} textAnchor="middle" className="text-[9px]" fill="#64748B">33kV Incoming</text>

      {/* Lightning Arrester on incoming */}
      <LightningArrester x={270} y={80} voltageColor="#DC2626" />

      {/* 33kV Incomer Isolator */}
      <DemoIsolator x={300} y={bus33Y - 50} tag="INC1_ISO" label="ISO" />

      {/* Connection from INC1_ISO to INC1_CB */}
      <ConnectionLine x1={300} y1={bus33Y - 42} x2={300} y2={bus33Y - 38} energized={energizationState.connectionLines['INC1_ISO_to_CB']} voltageLevel={33} />

      {/* 33kV Incomer CB */}
      <DemoCircuitBreaker x={300} y={bus33Y - 30} tag="INC1_CB" label="INC1" />
      
      {/* Connection from INC1_CB to 33kV Bus */}
      <ConnectionLine x1={300} y1={bus33Y - 20} x2={300} y2={bus33Y} energized={energizationState.connectionLines['INC1_CB_to_bus']} voltageLevel={33} />

      {/* Incomer Measurements */}
      <DemoMeasurementLabel x={340} y={bus33Y - 50} tag="INC1_V" label="V" unit="kV" />
      <DemoMeasurementLabel x={340} y={bus33Y - 32} tag="INC1_I" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={340} y={bus33Y - 14} tag="INC1_P" label="P" unit="MW" />

      {/* Earth Switch on incoming */}
      <DemoEarthSwitch x={270} y={bus33Y - 25} tag="INC1_ES" />

      {/* 33kV Bus Section 1 */}
      <BusBar 
        x={100} 
        y={bus33Y} 
        width={340} 
        voltageKv={33} 
        label="33kV Bus Section 1" 
        color={energizationState['33kV_Bus_Section_1'] ? ENERGIZED_COLOR : DE_ENERGIZED_COLOR}
      />

      {/* 33kV Bus Section Coupler Connection Lines */}
      <ConnectionLine 
        x1={440} 
        y1={bus33Y} 
        x2={490} 
        y2={bus33Y} 
        energized={energizationState.connectionLines['BSC_line_left']} 
        voltageLevel={33} 
      />
      
      {/* 33kV Bus Section CB */}
      <DemoCircuitBreaker x={500} y={bus33Y} tag="BSC_CB" label="BSC" />
      
      <ConnectionLine 
        x1={510} 
        y1={bus33Y} 
        x2={560} 
        y2={bus33Y} 
        energized={energizationState.connectionLines['BSC_line_right']} 
        voltageLevel={33} 
      />

      {/* 33kV Bus Section 2 */}
      <BusBar 
        x={560} 
        y={bus33Y} 
        width={340} 
        voltageKv={33} 
        label="33kV Bus Section 2"
        color={energizationState['33kV_Bus_Section_2'] ? ENERGIZED_COLOR : DE_ENERGIZED_COLOR}
      />

      {/* ==== Transformer 1 ==== */}
      {/* 33kV Bus to TR1_HV_ISO */}
      <ConnectionLine x1={300} y1={bus33Y} x2={300} y2={bus33Y + 12} energized={energizationState.connectionLines['bus33_to_TR1_HV_ISO']} voltageLevel={33} />
      <DemoIsolator x={300} y={bus33Y + 20} tag="TR1_HV_ISO" label="ISO" />
      {/* TR1_HV_ISO to TR1_HV_CB */}
      <ConnectionLine x1={300} y1={bus33Y + 28} x2={300} y2={bus33Y + 35} energized={energizationState.connectionLines['TR1_HV_ISO_to_CB']} voltageLevel={33} />
      <DemoCircuitBreaker x={300} y={bus33Y + 45} tag="TR1_HV_CB" label="TR1 HV" />
      {/* TR1_HV_CB to transformer HV side */}
      <ConnectionLine x1={300} y1={bus33Y + 55} x2={300} y2={bus33Y + 80} energized={energizationState.connectionLines['TR1_HV_CB_to_transformer']} voltageLevel={33} />
      <DemoEarthSwitch x={270} y={bus33Y + 50} tag="TR1_ES" />
      <PowerTransformer x={300} y={bus33Y + 100} hvVoltage={33} lvVoltage={11} label="TR-1" mva={8} />

      {/* TR1 Measurements */}
      <DemoMeasurementLabel x={340} y={bus33Y + 70} tag="TR1_V_HV" label="V" unit="kV" />
      <DemoMeasurementLabel x={340} y={bus33Y + 88} tag="TR1_I_HV" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={340} y={bus33Y + 106} tag="TR1_P" label="P" unit="MW" />
      <DemoMeasurementLabel x={340} y={bus33Y + 124} tag="TR1_OIL_TEMP" label="T" unit="°C" decimals={1} />

      {/* TR1 LV */}
      {/* Transformer LV side to TR1_LV_ISO - green when full path complete */}
      <ConnectionLine x1={300} y1={bus33Y + 120} x2={300} y2={bus33Y + 132} energized={energizationState.connectionLines['TR1_transformer_to_LV_ISO']} voltageLevel={11} />
      <DemoIsolator x={300} y={bus33Y + 140} tag="TR1_LV_ISO" label="ISO" />
      {/* TR1_LV_ISO to TR1_LV_CB */}
      <ConnectionLine x1={300} y1={bus33Y + 148} x2={300} y2={bus33Y + 155} energized={energizationState.connectionLines['TR1_LV_ISO_to_CB']} voltageLevel={11} />
      <DemoCircuitBreaker x={300} y={bus33Y + 165} tag="TR1_LV_CB" label="TR1 LV" />
      {/* TR1_LV_CB to 11kV Bus */}
      <ConnectionLine x1={300} y1={bus33Y + 175} x2={300} y2={bus11Y} energized={energizationState.connectionLines['TR1_LV_CB_to_bus']} voltageLevel={11} />

      {/* ==== Transformer 2 ==== */}
      {/* 33kV Bus to TR2_HV_ISO */}
      <ConnectionLine x1={700} y1={bus33Y} x2={700} y2={bus33Y + 12} energized={energizationState.connectionLines['bus33_to_TR2_HV_ISO']} voltageLevel={33} />
      <DemoIsolator x={700} y={bus33Y + 20} tag="TR2_HV_ISO" label="ISO" />
      {/* TR2_HV_ISO to TR2_HV_CB */}
      <ConnectionLine x1={700} y1={bus33Y + 28} x2={700} y2={bus33Y + 35} energized={energizationState.connectionLines['TR2_HV_ISO_to_CB']} voltageLevel={33} />
      <DemoCircuitBreaker x={700} y={bus33Y + 45} tag="TR2_HV_CB" label="TR2 HV" />
      {/* TR2_HV_CB to transformer HV side */}
      <ConnectionLine x1={700} y1={bus33Y + 55} x2={700} y2={bus33Y + 80} energized={energizationState.connectionLines['TR2_HV_CB_to_transformer']} voltageLevel={33} />
      <DemoEarthSwitch x={670} y={bus33Y + 50} tag="TR2_ES" />
      <PowerTransformer x={700} y={bus33Y + 100} hvVoltage={33} lvVoltage={11} label="TR-2" mva={8} />

      {/* TR2 Measurements */}
      <DemoMeasurementLabel x={740} y={bus33Y + 70} tag="TR2_V_HV" label="V" unit="kV" />
      <DemoMeasurementLabel x={740} y={bus33Y + 88} tag="TR2_I_HV" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={740} y={bus33Y + 106} tag="TR2_P" label="P" unit="MW" />
      <DemoMeasurementLabel x={740} y={bus33Y + 124} tag="TR2_OIL_TEMP" label="T" unit="°C" decimals={1} />

      {/* TR2 LV */}
      {/* Transformer LV side to TR2_LV_ISO - green when full path complete */}
      <ConnectionLine x1={700} y1={bus33Y + 120} x2={700} y2={bus33Y + 132} energized={energizationState.connectionLines['TR2_transformer_to_LV_ISO']} voltageLevel={11} />
      <DemoIsolator x={700} y={bus33Y + 140} tag="TR2_LV_ISO" label="ISO" />
      {/* TR2_LV_ISO to TR2_LV_CB */}
      <ConnectionLine x1={700} y1={bus33Y + 148} x2={700} y2={bus33Y + 155} energized={energizationState.connectionLines['TR2_LV_ISO_to_CB']} voltageLevel={11} />
      <DemoCircuitBreaker x={700} y={bus33Y + 165} tag="TR2_LV_CB" label="TR2 LV" />
      {/* TR2_LV_CB to 11kV Bus */}
      <ConnectionLine x1={700} y1={bus33Y + 175} x2={700} y2={bus11Y} energized={energizationState.connectionLines['TR2_LV_CB_to_bus']} voltageLevel={11} />

      {/* Lightning Arresters on transformers */}
      <LightningArrester x={330} y={bus33Y + 75} voltageColor="#DC2626" />
      <LightningArrester x={730} y={bus33Y + 75} voltageColor="#DC2626" />

      {/* 11kV Bus Section 1 */}
      <BusBar 
        x={80} 
        y={bus11Y} 
        width={360} 
        voltageKv={11} 
        label="11kV Bus Section 1" 
        color={energizationState['11kV_Bus_Section_1'] ? ENERGIZED_COLOR : DE_ENERGIZED_COLOR}
      />

      {/* 11kV Bus Section Coupler Connection Lines */}
      <ConnectionLine 
        x1={440} 
        y1={bus11Y} 
        x2={490} 
        y2={bus11Y} 
        energized={energizationState.connectionLines['BC_line_left']} 
        voltageLevel={11} 
      />
      
      {/* 11kV Bus Coupler CB */}
      <DemoCircuitBreaker x={500} y={bus11Y} tag="BC_CB" label="BC" />
      
      <ConnectionLine 
        x1={510} 
        y1={bus11Y} 
        x2={560} 
        y2={bus11Y} 
        energized={energizationState.connectionLines['BC_line_right']} 
        voltageLevel={11} 
      />

      {/* 11kV Bus Section 2 */}
      <BusBar 
        x={560} 
        y={bus11Y} 
        width={360} 
        voltageKv={11} 
        label="11kV Bus Section 2" 
        color={energizationState['11kV_Bus_Section_2'] ? ENERGIZED_COLOR : DE_ENERGIZED_COLOR}
      />

      {/* 11kV Bus voltage */}
      <DemoMeasurementLabel x={430} y={bus11Y + 15} tag="BUS_11KV_V" label="V" unit="kV" />

      {/* ==== 11kV Feeders ==== */}
      {Array.from({ length: 6 }, (_, i) => {
        const fdrNum = String(i + 1).padStart(2, '0');
        const fdrTag = `FDR${fdrNum}_CB`;
        const fdrX = i < 3
          ? 130 + i * 120
          : 580 + (i - 3) * 120;

        return (
          <g key={`fdr${i + 1}`}>
            {/* 11kV Bus to Feeder CB */}
            <ConnectionLine 
              x1={fdrX} 
              y1={bus11Y} 
              x2={fdrX} 
              y2={bus11Y + 15} 
              energized={energizationState.connectionLines[`FDR${fdrNum}_line`] || false} 
              voltageLevel={11} 
            />
            <DemoCircuitBreaker
              x={fdrX}
              y={bus11Y + 25}
              tag={fdrTag}
              label={`F${i + 1}`}
            />
            {/* Feeder CB to Feeder Line */}
            <ConnectionLine 
              x1={fdrX} 
              y1={bus11Y + 35} 
              x2={fdrX} 
              y2={bus11Y + 42} 
              energized={energizationState.connectionLines[`FDR${fdrNum}_line`] || false} 
              voltageLevel={11} 
            />
            <FeederLine x={fdrX} y={bus11Y + 50} voltageKv={11} label={`FDR ${i + 1}`} />
            <DemoAlarmBadge x={fdrX + 15} y={bus11Y + 15} equipmentTag={`feeder ${i + 1}`} />

            {/* Feeder measurements */}
            <DemoMeasurementLabel x={fdrX + 15} y={bus11Y + 55} tag={`FDR${fdrNum}_I`} label="I" unit="A" decimals={1} />
            <DemoMeasurementLabel x={fdrX + 15} y={bus11Y + 73} tag={`FDR${fdrNum}_P`} label="P" unit="MW" />
          </g>
        );
      })}
    </g>
  );
}
