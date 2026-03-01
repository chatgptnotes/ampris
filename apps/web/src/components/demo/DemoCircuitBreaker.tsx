import { useSimulationContext } from './DemoSimulationContext';
import type { CBState } from './useSimulation';

const CB_COLORS: Record<CBState, string> & Record<string, string> = {
  OPEN: '#16A34A',
  CLOSED: '#DC2626',
  TRIPPED: '#DC2626',
};

interface Props {
  x: number;
  y: number;
  tag: string;
  label?: string;
}

export default function DemoCircuitBreaker({ x, y, tag, label }: Props) {
  const { cbStates, toggleCB, setSelectedEquipment } = useSimulationContext();
  const cbState = cbStates[tag] || 'OPEN';
  const color = CB_COLORS[cbState];
  const size = 20;

  return (
    <g
      onClick={() => {
        toggleCB(tag);
        setSelectedEquipment(tag);
      }}
      className="cursor-pointer"
    >
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        fill={cbState === 'CLOSED' ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        rx={2}
      />

      {cbState === 'CLOSED' ? (
        <>
          <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke="white" strokeWidth={2} />
          <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke="white" strokeWidth={2} />
        </>
      ) : (
        <>
          <line x1={x - 6} y1={y + 6} x2={x} y2={y - 2} stroke={color} strokeWidth={2} />
          <line x1={x + 6} y1={y + 6} x2={x} y2={y - 2} stroke={color} strokeWidth={2} />
        </>
      )}

      {cbState === 'TRIPPED' && (
        <rect
          x={x - size / 2 - 2}
          y={y - size / 2 - 2}
          width={size + 4}
          height={size + 4}
          fill="none"
          stroke="#DC2626"
          strokeWidth={2}
          className="alarm-flash"
          rx={3}
        />
      )}

      <line x1={x} y1={y - size / 2} x2={x} y2={y - size / 2 - 10} stroke="#94A3B8" strokeWidth={2} />
      <line x1={x} y1={y + size / 2} x2={x} y2={y + size / 2 + 10} stroke="#94A3B8" strokeWidth={2} />

      {label && (
        <text x={x + size / 2 + 5} y={y + 4} className="text-[8px]" fill="#475569">
          {label}
        </text>
      )}

      <text x={x} y={y + size / 2 + 22} textAnchor="middle" className="text-[7px]" fill={color}>
        {cbState}
      </text>
    </g>
  );
}
