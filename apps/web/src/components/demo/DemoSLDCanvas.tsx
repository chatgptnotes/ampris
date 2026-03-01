import { useState, useCallback, useRef, type WheelEvent, type MouseEvent } from 'react';
import DemoViewport from './DemoViewport';
import DemoLayout33_11kV from './DemoLayout33_11kV';

export default function DemoSLDCanvas() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.4, Math.min(2.5, prev - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || e.button === 0 && e.altKey) {
      setIsPanning(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      className="w-full h-full overflow-hidden rounded-xl border border-gray-200 bg-white"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <DemoViewport zoom={zoom} panX={pan.x} panY={pan.y}>
        <DemoLayout33_11kV />
      </DemoViewport>
    </div>
  );
}
