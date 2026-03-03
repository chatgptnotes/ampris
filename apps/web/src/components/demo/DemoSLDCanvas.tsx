import { useState, useCallback, useRef, useEffect, type MouseEvent } from 'react';
import DemoViewport from './DemoViewport';
import DemoLayout33_11kV from './DemoLayout33_11kV';

export default function DemoSLDCanvas() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseOver, setIsMouseOver] = useState(false);

  // Bulletproof wheel event handling to prevent page scroll when mouse is over SLD
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const onWheel = (e: globalThis.WheelEvent) => {
      // Only handle wheel events when mouse is inside the SLD container
      const rect = el.getBoundingClientRect();
      const isInsideContainer = 
        e.clientX >= rect.left && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.bottom;
      
      if (isInsideContainer) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Apply zoom with responsive scaling
        const zoomSpeed = 0.003;
        const deltaZoom = -e.deltaY * zoomSpeed;
        setZoom((prev) => Math.max(0.3, Math.min(4, prev + deltaZoom)));
        
        // Return false to ensure no further propagation
        return false;
      }
    };
    
    // Add event listener to the element with capture and non-passive
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    
    return () => el.removeEventListener('wheel', onWheel, { capture: true } as any);
  }, []);

  // Additional document-level protection to prevent page scroll when mouse is over SLD
  useEffect(() => {
    const onDocumentWheel = (e: globalThis.WheelEvent) => {
      if (isMouseOver) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    
    document.addEventListener('wheel', onDocumentWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onDocumentWheel, { capture: true } as any);
  }, [isMouseOver]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
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

  const handleMouseEnter = useCallback(() => {
    setIsMouseOver(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsMouseOver(false);
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
        isMouseOver ? 'border-blue-300 shadow-md' : 'border-gray-200'
      } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ 
        touchAction: 'none', 
        overscrollBehavior: 'contain',
        position: 'relative',
        isolation: 'isolate'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <DemoViewport zoom={zoom} panX={pan.x} panY={pan.y}>
        <DemoLayout33_11kV />
      </DemoViewport>
    </div>
  );
}
