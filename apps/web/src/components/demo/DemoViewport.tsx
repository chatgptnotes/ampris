import { type ReactNode } from 'react';

interface Props {
  zoom: number;
  panX: number;
  panY: number;
  children: ReactNode;
}

export default function DemoViewport({ zoom, panX, panY, children }: Props) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1200 800"
      className="select-none"
    >
      <defs>
        <pattern id="demo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* White background + light grid */}
      <rect width="100%" height="100%" fill="#FFFFFF" />
      <rect width="100%" height="100%" fill="url(#demo-grid)" />

      <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
        {children}
      </g>
    </svg>
  );
}
