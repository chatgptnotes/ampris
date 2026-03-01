import BusBar from '../sld/equipment/BusBar';
import PowerTransformer from '../sld/equipment/PowerTransformer';
import FeederLine from '../sld/equipment/FeederLine';
import LightningArrester from '../sld/equipment/LightningArrester';
import DemoCircuitBreaker from './DemoCircuitBreaker';
import DemoIsolator from './DemoIsolator';
import DemoEarthSwitch from './DemoEarthSwitch';
import DemoMeasurementLabel from './DemoMeasurementLabel';
import DemoAlarmBadge from './DemoAlarmBadge';

export default function DemoLayout33_11kV() {
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

      {/* 33kV Incoming Line */}
      <line x1={300} y1={55} x2={300} y2={bus33Y - 55} stroke="#DC2626" strokeWidth={2} />
      <text x={300} y={60} textAnchor="middle" className="text-[9px]" fill="#64748B">33kV Incoming</text>

      {/* Lightning Arrester on incoming */}
      <LightningArrester x={270} y={80} voltageColor="#DC2626" />

      {/* 33kV Incomer Isolator */}
      <DemoIsolator x={300} y={bus33Y - 50} tag="INC1_ISO" label="ISO" />

      {/* 33kV Incomer CB */}
      <DemoCircuitBreaker x={300} y={bus33Y - 30} tag="INC1_CB" label="INC1" />

      {/* Incomer Measurements */}
      <DemoMeasurementLabel x={340} y={bus33Y - 50} tag="INC1_V" label="V" unit="kV" />
      <DemoMeasurementLabel x={340} y={bus33Y - 32} tag="INC1_I" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={340} y={bus33Y - 14} tag="INC1_P" label="P" unit="MW" />

      {/* Earth Switch on incoming */}
      <DemoEarthSwitch x={270} y={bus33Y - 25} tag="INC1_ES" />

      {/* 33kV Bus Section 1 */}
      <BusBar x={100} y={bus33Y} width={350} voltageKv={33} label="33kV Bus Section 1" />

      {/* 33kV Bus Section CB */}
      <DemoCircuitBreaker x={500} y={bus33Y} tag="BSC_CB" label="BSC" />

      {/* 33kV Bus Section 2 */}
      <BusBar x={550} y={bus33Y} width={350} voltageKv={33} label="33kV Bus Section 2" />

      {/* ==== Transformer 1 ==== */}
      <line x1={300} y1={bus33Y} x2={300} y2={bus33Y + 15} stroke="#94A3B8" strokeWidth={2} />
      <DemoIsolator x={300} y={bus33Y + 20} tag="TR1_HV_ISO" label="ISO" />
      <DemoCircuitBreaker x={300} y={bus33Y + 45} tag="TR1_HV_CB" label="TR1 HV" />
      <DemoEarthSwitch x={270} y={bus33Y + 50} tag="TR1_ES" />
      <PowerTransformer x={300} y={bus33Y + 100} hvVoltage={33} lvVoltage={11} label="TR-1" mva={8} />

      {/* TR1 Measurements */}
      <DemoMeasurementLabel x={340} y={bus33Y + 70} tag="TR1_V_HV" label="V" unit="kV" />
      <DemoMeasurementLabel x={340} y={bus33Y + 88} tag="TR1_I_HV" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={340} y={bus33Y + 106} tag="TR1_P" label="P" unit="MW" />
      <DemoMeasurementLabel x={340} y={bus33Y + 124} tag="TR1_OIL_TEMP" label="T" unit="°C" decimals={1} />

      {/* TR1 LV */}
      <DemoIsolator x={300} y={bus33Y + 140} tag="TR1_LV_ISO" label="ISO" />
      <DemoCircuitBreaker x={300} y={bus33Y + 165} tag="TR1_LV_CB" label="TR1 LV" />
      <line x1={300} y1={bus33Y + 185} x2={300} y2={bus11Y} stroke="#94A3B8" strokeWidth={2} />

      {/* ==== Transformer 2 ==== */}
      <line x1={700} y1={bus33Y} x2={700} y2={bus33Y + 15} stroke="#94A3B8" strokeWidth={2} />
      <DemoIsolator x={700} y={bus33Y + 20} tag="TR2_HV_ISO" label="ISO" />
      <DemoCircuitBreaker x={700} y={bus33Y + 45} tag="TR2_HV_CB" label="TR2 HV" />
      <DemoEarthSwitch x={670} y={bus33Y + 50} tag="TR2_ES" />
      <PowerTransformer x={700} y={bus33Y + 100} hvVoltage={33} lvVoltage={11} label="TR-2" mva={8} />

      {/* TR2 Measurements */}
      <DemoMeasurementLabel x={740} y={bus33Y + 70} tag="TR2_V_HV" label="V" unit="kV" />
      <DemoMeasurementLabel x={740} y={bus33Y + 88} tag="TR2_I_HV" label="I" unit="A" decimals={1} />
      <DemoMeasurementLabel x={740} y={bus33Y + 106} tag="TR2_P" label="P" unit="MW" />
      <DemoMeasurementLabel x={740} y={bus33Y + 124} tag="TR2_OIL_TEMP" label="T" unit="°C" decimals={1} />

      {/* TR2 LV */}
      <DemoIsolator x={700} y={bus33Y + 140} tag="TR2_LV_ISO" label="ISO" />
      <DemoCircuitBreaker x={700} y={bus33Y + 165} tag="TR2_LV_CB" label="TR2 LV" />
      <line x1={700} y1={bus33Y + 185} x2={700} y2={bus11Y} stroke="#94A3B8" strokeWidth={2} />

      {/* Lightning Arresters on transformers */}
      <LightningArrester x={330} y={bus33Y + 75} voltageColor="#DC2626" />
      <LightningArrester x={730} y={bus33Y + 75} voltageColor="#DC2626" />

      {/* 11kV Bus Section 1 */}
      <BusBar x={80} y={bus11Y} width={370} voltageKv={11} label="11kV Bus Section 1" />

      {/* 11kV Bus Coupler CB */}
      <DemoCircuitBreaker x={500} y={bus11Y} tag="BC_CB" label="BC" />

      {/* 11kV Bus Section 2 */}
      <BusBar x={550} y={bus11Y} width={370} voltageKv={11} label="11kV Bus Section 2" />

      {/* 11kV Bus voltage */}
      <DemoMeasurementLabel x={430} y={bus11Y + 15} tag="BUS_11KV_V" label="V" unit="kV" />

      {/* ==== 11kV Feeders ==== */}
      {Array.from({ length: 6 }, (_, i) => {
        const fdrNum = String(i + 1).padStart(2, '0');
        const fdrX = i < 3
          ? 130 + i * 120
          : 580 + (i - 3) * 120;

        return (
          <g key={`fdr${i + 1}`}>
            <line x1={fdrX} y1={bus11Y} x2={fdrX} y2={bus11Y + 15} stroke="#94A3B8" strokeWidth={2} />
            <DemoCircuitBreaker
              x={fdrX}
              y={bus11Y + 25}
              tag={`FDR${fdrNum}_CB`}
              label={`F${i + 1}`}
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
