import { useSimulationContext } from './DemoSimulationContext';

interface Props {
  x: number;
  y: number;
  tag: string;
  label: string;
  unit: string;
  decimals?: number;
}

export default function DemoMeasurementLabel({ x, y, tag, label, unit, decimals = 2 }: Props) {
  const { measurements } = useSimulationContext();
  const value = measurements[tag];
  const display = value !== undefined ? value.toFixed(decimals) : '---';

  return (
    <g>
      <rect x={x} y={y - 8} width={65} height={16} rx={2} fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={0.5} />
      <text x={x + 3} y={y + 3} className="text-[7px]" fill="#64748B">{label}</text>
      <text x={x + 62} y={y + 3} textAnchor="end" className="text-[8px] font-mono font-medium" fill="#1E293B">
        {display} {unit}
      </text>
    </g>
  );
}
