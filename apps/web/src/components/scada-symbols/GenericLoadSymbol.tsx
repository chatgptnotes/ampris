import React from 'react';
interface Props { width?: number; height?: number; state?: string; color?: string; label?: string; rotation?: number; }
export default function GenericLoadSymbol({ width = 60, height = 60, state = 'ON', color, label, rotation }: Props) {
  const c = color || (state === 'ON' ? '#16A34A' : state === 'FAULT' ? '#DC2626' : '#9CA3AF');
  return (
    <svg width={width} height={height} viewBox="0 0 60 60" style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}>
      {/* Triangle pointing down = load */}
      <polygon points="30,10 50,45 10,45" fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="30" y1="45" x2="30" y2="55" stroke={c} strokeWidth="2" />
      <line x1="20" y1="55" x2="40" y2="55" stroke={c} strokeWidth="2" />
      {/* Connection at top */}
      <line x1="30" y1="2" x2="30" y2="10" stroke={c} strokeWidth="2" />
      {label && <text x="30" y="33" textAnchor="middle" fontSize="8" fontWeight="bold" fill={c}>{label.length > 6 ? label.slice(0, 5) + '…' : label}</text>}
    </svg>
  );
}
