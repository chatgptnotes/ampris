import { useDigitalState } from '@/hooks/useRealTimeData';
import { CB_STATE_COLORS } from '@gridvision/shared';
import type { CBState } from '@gridvision/shared';

interface Props {
  x: number;
  y: number;
  tag: string;
  label?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export default function CircuitBreaker({ x, y, tag, label, onClick, onDoubleClick }: Props) {
  const state = useDigitalState(`${tag}_STATUS`);
  const cbState: CBState = state === undefined ? 'UNKNOWN' : state ? 'CLOSED' : 'OPEN';
  const color = CB_STATE_COLORS[cbState];
  const size = 20;

  return (
    <g
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="cursor-pointer"
    >
      {/* CB body - square */}
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

      {/* X symbol for closed, gap for open */}
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

      {/* Tripped animation */}
      {(cbState as string) === 'TRIPPED' && (
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

      {/* Connection points */}
      <line x1={x} y1={y - size / 2} x2={x} y2={y - size / 2 - 10} stroke="#94A3B8" strokeWidth={2} />
      <line x1={x} y1={y + size / 2} x2={x} y2={y + size / 2 + 10} stroke="#94A3B8" strokeWidth={2} />

      {/* Label */}
      {label && (
        <text x={x + size / 2 + 5} y={y + 4} className="text-[8px] fill-gray-400">
          {label}
        </text>
      )}

      {/* State text */}
      <text x={x} y={y + size / 2 + 22} textAnchor="middle" className="text-[7px]" fill={color}>
        {cbState}
      </text>
    </g>
  );
}
