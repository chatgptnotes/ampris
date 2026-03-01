import { useSimulationContext } from './DemoSimulationContext';

interface Props {
  x: number;
  y: number;
  equipmentTag: string;
}

export default function DemoAlarmBadge({ x, y, equipmentTag }: Props) {
  const { alarms } = useSimulationContext();
  const hasAlarm = alarms.some(
    (a) => a.equipment.toLowerCase().includes(equipmentTag.toLowerCase()) && !a.acknowledged,
  );

  if (!hasAlarm) return null;

  return (
    <g>
      <circle cx={x} cy={y} r={6} fill="#DC2626" className="alarm-flash" />
      <text x={x} y={y + 3} textAnchor="middle" className="text-[6px] font-bold" fill="white">!</text>
    </g>
  );
}
