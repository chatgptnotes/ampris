// ⚠️ READ SKILL FILE BEFORE MODIFYING
// ~/.openclaw/workspace/skills/gridvision-sld-ai/SKILL.md
//
// SLD Layout Engine — Deterministic coordinate assignment for substation SLDs
// Claude outputs TOPOLOGY ONLY (what exists + labels).
// This engine assigns ALL x,y,width,height,connections — zero AI guessing.

import { v4 as uuidv4 } from 'uuid';
import { normalizeType } from './sld-generation.service';

// ─── Canvas & spacing constants ────────────────────────────────────────────
const CANVAS_W        = 1600;
const CANVAS_H        = 900;
const MARGIN_LEFT     = 80;
const BUSBAR_Y        = 370;   // top of main busbar
const BUSBAR_H        = 20;
const ELEMENT_SPACING = 95;    // vertical gap between chain elements (center-to-center)
const FEEDER_SPACING  = 140;   // horizontal gap between feeder columns
const MIN_BUSBAR_W    = 500;

// ─── Element sizes (exact, matching SYMBOL_MAP rendering) ─────────────────
const SIZES: Record<string, { w: number; h: number }> = {
  BusBar:               { w: 0,  h: 20  }, // width set dynamically
  DoubleBusBar:         { w: 0,  h: 30  },
  BusSection:           { w: 40, h: 25  },
  VacuumCB:             { w: 40, h: 40  },
  SF6CB:                { w: 40, h: 40  },
  ACB:                  { w: 40, h: 40  },
  CB:                   { w: 40, h: 40  },
  MCCB:                 { w: 35, h: 35  },
  MCB:                  { w: 30, h: 35  },
  RCCB:                 { w: 35, h: 35  },
  Fuse:                 { w: 30, h: 40  },
  Contactor:            { w: 35, h: 35  },
  Isolator:             { w: 40, h: 25  },
  EarthSwitch:          { w: 30, h: 30  },
  LoadBreakSwitch:      { w: 40, h: 30  },
  AutoRecloser:         { w: 40, h: 45  },
  RingMainUnit:         { w: 60, h: 60  },
  GIS:                  { w: 60, h: 60  },
  Transformer:          { w: 70, h: 90  },
  AutoTransformer:      { w: 70, h: 90  },
  InstrumentTransformer:{ w: 50, h: 60  },
  StepVoltageRegulator: { w: 60, h: 80  },
  CT:                   { w: 35, h: 25  },
  PT:                   { w: 35, h: 25  },
  Meter:                { w: 40, h: 40  },
  EnergyMeter:          { w: 40, h: 40  },
  LightningArrester:    { w: 30, h: 50  },
  Relay:                { w: 40, h: 40  },
  OvercurrentRelay:     { w: 40, h: 40  },
  EarthFaultRelay:      { w: 40, h: 40  },
  DifferentialRelay:    { w: 40, h: 40  },
  DistanceRelay:        { w: 40, h: 40  },
  Feeder:               { w: 40, h: 60  },
  GenericLoad:          { w: 50, h: 50  },
  ResistiveLoad:        { w: 50, h: 50  },
  InductiveLoad:        { w: 50, h: 50  },
  Motor:                { w: 50, h: 50  },
  Generator:            { w: 60, h: 60  },
  SolarInverter:        { w: 50, h: 50  },
  CapacitorBank:        { w: 50, h: 50  },
  ShuntReactor:         { w: 50, h: 60  },
  OverheadLine:         { w: 40, h: 40  },
  Cable:                { w: 40, h: 30  },
  Ground:               { w: 30, h: 30  },
  Junction:             { w: 10, h: 10  },
};

function elSize(type: string): { w: number; h: number } {
  return SIZES[type] || { w: 60, h: 60 };
}

// ─── Topology types ────────────────────────────────────────────────────────
export interface TopoElement {
  id: string;
  type: string;   // exact SYMBOL_MAP key (enforced by normalizeType)
  label?: string;
  voltage?: number;
}

export interface TopoChain {
  id?: string;
  label?: string;
  elements: TopoElement[];   // ordered top → bottom
}

export interface SubstationTopology {
  name?: string;
  topologyType?: 'single-busbar' | 'double-busbar' | 'ring';
  busbar: TopoElement;              // the main HV busbar
  lvBusbar?: TopoElement;           // LV busbar (if transformer present)
  incomers: TopoChain[];            // chains above the busbar
  feeders:  TopoChain[];            // chains below the busbar
  transformers?: TopoElement[];     // between HV and LV bus
}

// ─── Placed element ────────────────────────────────────────────────────────
interface PlacedEl {
  id: string;
  type: string;
  x: number; y: number; width: number; height: number;
  rotation: number; zIndex: number;
  properties: Record<string, any>;
}

function makeEl(uid: string, type: string, x: number, y: number, label: string, zIdx = 5, extra: Record<string, any> = {}): PlacedEl {
  const s = elSize(type);
  return {
    id: uid, type,
    x: Math.round(x), y: Math.round(y),
    width: s.w, height: s.h,
    rotation: 0, zIndex: zIdx,
    properties: { label, showLabel: true, tagBindings: {}, ...extra },
  };
}

function wire(fromId: string, toId: string, fromEl: PlacedEl, toEl: PlacedEl, color = '#374151', thick = 2) {
  // Connect bottom-center of upper element to top-center of lower element
  const [topEl, botEl, topId, botId] = fromEl.y <= toEl.y
    ? [fromEl, toEl, fromId, toId]
    : [toEl, fromEl, toId, fromId];

  const fx = Math.round(topEl.x + topEl.width  / 2);
  const fy = Math.round(topEl.y + topEl.height);
  const tx = Math.round(botEl.x + botEl.width  / 2);
  const ty = Math.round(botEl.y);

  const pts = fx === tx
    ? [{ x: fx, y: fy }, { x: tx, y: ty }]
    : [{ x: fx, y: fy }, { x: fx, y: Math.round((fy + ty) / 2) },
       { x: tx, y: Math.round((fy + ty) / 2) }, { x: tx, y: ty }];

  return { id: uuidv4(), fromId: topId, toId: botId, points: pts, color, thickness: thick };
}

// ─── Main layout function ──────────────────────────────────────────────────
export function layoutSubstation(topo: SubstationTopology): { elements: PlacedEl[]; connections: any[] } {
  const elements: PlacedEl[] = [];
  const connections: any[]   = [];

  const incomers     = topo.incomers     || [];
  const feeders      = topo.feeders      || [];
  const transformers = topo.transformers || [];

  // Total columns: incomers | feeders | transformers
  const totalCols = incomers.length + feeders.length + transformers.length;

  // Busbar width spans all columns with padding
  const busbarWidth = Math.max(MIN_BUSBAR_W, totalCols * FEEDER_SPACING + MARGIN_LEFT * 2);
  const busbarX     = MARGIN_LEFT;
  const busbarY     = BUSBAR_Y;

  // Normalize busbar type
  const busNorm = normalizeType(topo.busbar?.type || 'BusBar');

  // Place main busbar
  const busbarUid = uuidv4();
  const busbarEl: PlacedEl = {
    id: busbarUid,
    type: busNorm.type === 'BusBar' || busNorm.type === 'DoubleBusBar' ? busNorm.type : 'BusBar',
    x: busbarX, y: busbarY,
    width: busbarWidth, height: BUSBAR_H,
    rotation: 0, zIndex: 10,
    properties: {
      label: topo.busbar?.label || `${topo.busbar?.voltage || 11}kV Busbar`,
      showLabel: true, tagBindings: {},
      voltageLevel: topo.busbar?.voltage,
      labelPosition: 'top',
    },
  };
  elements.push(busbarEl);

  // Column center X positions — evenly spaced across busbar
  const colCenterX = (colIdx: number): number =>
    Math.round(busbarX + (colIdx + 0.5) * (busbarWidth / Math.max(totalCols, 1)));

  let colIdx = 0;

  // ── Place incomer chains (above busbar) ────────────────────────────────
  for (const incomer of incomers) {
    const cx = colCenterX(colIdx++);
    placeChainAbove(incomer.elements, cx, busbarY, busbarUid, busbarEl, elements, connections);
  }

  // ── Place feeder chains (below busbar) ────────────────────────────────
  for (const feeder of feeders) {
    const cx = colCenterX(colIdx++);
    placeChainBelow(feeder.elements, cx, busbarY + BUSBAR_H, busbarUid, busbarEl, elements, connections);
  }

  // ── Place transformers ─────────────────────────────────────────────────
  for (const tr of transformers) {
    const cx      = colCenterX(colIdx++);
    const norm    = normalizeType(tr.type || 'Transformer');
    const size    = elSize(norm.type);
    const trUid   = uuidv4();
    const trY     = busbarY + BUSBAR_H + ELEMENT_SPACING;
    const trX     = Math.round(cx - size.w / 2);

    const trEl: PlacedEl = {
      id: trUid, type: norm.type,
      x: trX, y: trY, width: size.w, height: size.h,
      rotation: 0, zIndex: 5,
      properties: { label: tr.label || 'Transformer', showLabel: true, tagBindings: {} },
    };
    elements.push(trEl);

    // Wire busbar tap → transformer top (vertical)
    const tapX = cx;
    connections.push({
      id: uuidv4(), fromId: busbarUid, toId: trUid,
      points: [{ x: tapX, y: busbarY + BUSBAR_H }, { x: tapX, y: trY }],
      color: '#1d4ed8', thickness: 2,
    });

    // Add LV busbar below transformer if topology has one
    if (topo.lvBusbar) {
      const lvNorm   = normalizeType(topo.lvBusbar.type || 'BusBar');
      const lvY      = trY + size.h + Math.round(ELEMENT_SPACING * 0.6);
      const lvUid    = uuidv4();
      const lvBusW   = Math.max(300, feeders.length * FEEDER_SPACING);
      const lvBusX   = Math.round(cx - lvBusW / 2);

      const lvBusEl: PlacedEl = {
        id: lvUid, type: lvNorm.type === 'BusBar' ? 'BusBar' : 'BusBar',
        x: lvBusX, y: lvY, width: lvBusW, height: BUSBAR_H,
        rotation: 0, zIndex: 9,
        properties: {
          label: topo.lvBusbar.label || `${topo.lvBusbar.voltage || 0.4}kV Busbar`,
          showLabel: true, tagBindings: {},
          voltageLevel: topo.lvBusbar.voltage,
          labelPosition: 'top',
        },
      };
      elements.push(lvBusEl);

      // Wire transformer bottom → LV busbar
      connections.push({
        id: uuidv4(), fromId: trUid, toId: lvUid,
        points: [
          { x: Math.round(trX + size.w / 2), y: trY + size.h },
          { x: Math.round(lvBusX + lvBusW / 2), y: lvY },
        ],
        color: '#16a34a', thickness: 2,
      });
    }
  }

  return { elements, connections };
}

// ─── Chain above busbar ────────────────────────────────────────────────────
// elements[0] = topmost (source), elements[last] = closest to busbar
function placeChainAbove(
  chain: TopoElement[], cx: number, busbarY: number,
  busbarUid: string, busbarEl: PlacedEl,
  elements: PlacedEl[], connections: any[],
) {
  const placed: PlacedEl[] = [];

  for (let i = chain.length - 1; i >= 0; i--) {
    const el    = chain[i];
    const norm  = normalizeType(el.type || 'CB');
    const size  = elSize(norm.type);
    const rank  = chain.length - i;                           // 1 = closest to busbar
    const y     = busbarY - rank * ELEMENT_SPACING - size.h;
    const x     = Math.round(cx - size.w / 2);

    const uid  = uuidv4();
    const pEl  = makeEl(uid, norm.type, x, Math.max(10, y), el.label || norm.type, 5);
    elements.push(pEl);
    placed.unshift(pEl);  // keep in top-down order

    if (placed.length === 1) {
      // Bottom-most element of chain — wire to busbar
      const fx = Math.round(pEl.x + pEl.width  / 2);
      const fy = pEl.y + pEl.height;
      const ty = busbarY;
      connections.push({
        id: uuidv4(), fromId: uid, toId: busbarUid,
        points: [{ x: fx, y: fy }, { x: fx, y: ty }],
        color: '#374151', thickness: 2,
      });
    }
  }

  // Wire consecutive elements (top-down)
  for (let k = 0; k < placed.length - 1; k++) {
    connections.push(wire(placed[k].id, placed[k + 1].id, placed[k], placed[k + 1]));
  }
}

// ─── Chain below busbar ────────────────────────────────────────────────────
// elements[0] = closest to busbar, elements[last] = bottommost (load)
function placeChainBelow(
  chain: TopoElement[], cx: number, busbarBottom: number,
  busbarUid: string, busbarEl: PlacedEl,
  elements: PlacedEl[], connections: any[],
) {
  const placed: PlacedEl[] = [];

  for (let i = 0; i < chain.length; i++) {
    const el    = chain[i];
    const norm  = normalizeType(el.type || 'GenericLoad');
    const size  = elSize(norm.type);
    const rank  = i + 1;                                       // 1 = closest to busbar
    const y     = busbarBottom + rank * ELEMENT_SPACING - size.h / 2;
    const x     = Math.round(cx - size.w / 2);

    const uid  = uuidv4();
    const pEl  = makeEl(uid, norm.type, x, Math.max(busbarBottom + 10, y), el.label || norm.type, 5);
    elements.push(pEl);
    placed.push(pEl);

    if (placed.length === 1) {
      // Top-most element of feeder chain — wire from busbar tap
      const tx = Math.round(pEl.x + pEl.width / 2);
      const ty = pEl.y;
      connections.push({
        id: uuidv4(), fromId: busbarUid, toId: uid,
        points: [{ x: tx, y: busbarBottom }, { x: tx, y: ty }],
        color: '#374151', thickness: 2,
      });
    }
  }

  // Wire consecutive elements (top-down)
  for (let k = 0; k < placed.length - 1; k++) {
    connections.push(wire(placed[k].id, placed[k + 1].id, placed[k], placed[k + 1]));
  }
}
