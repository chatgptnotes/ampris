import { useSimulationContext } from './DemoSimulationContext';

interface Props {
  x: number;
  y: number;
  tag: string;
  label?: string;
}

export default function DemoIsolator({ x, y, tag, label }: Props) {
  const { isolatorStates, toggleIsolator, setSelectedEquipment } = useSimulationContext();
  const isClosed = isolatorStates[tag] ?? false;
  const color = isClosed ? '#DC2626' : '#16A34A';

  return (
    <g
      onClick={() => {
        toggleIsolator(tag);
        setSelectedEquipment(tag);
      }}
      className="cursor-pointer"
    >
      {/* Shortened connection stubs - let ConnectionLine handle coloring */}
      <line x1={x} y1={y - 8} x2={x} y2={y - 5} stroke="#94A3B8" strokeWidth={2} />
      <line x1={x} y1={y + 8} x2={x} y2={y + 5} stroke="#94A3B8" strokeWidth={2} />

      {isClosed ? (
        <>
          <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke={color} strokeWidth={2} />
          <circle cx={x} cy={y - 5} r={3} fill={color} />
          <circle cx={x} cy={y + 5} r={3} fill={color} />
        </>
      ) : (
        <>
          <line x1={x} y1={y + 5} x2={x - 8} y2={y - 8} stroke={color} strokeWidth={2} />
          <circle cx={x} cy={y + 5} r={3} fill={color} />
          <circle cx={x - 8} cy={y - 8} r={3} fill="none" stroke={color} strokeWidth={1.5} />
        </>
      )}

      {label && (
        <text x={x + 10} y={y + 3} className="text-[7px]" fill="#64748B">{label}</text>
      )}
    </g>
  );
}
