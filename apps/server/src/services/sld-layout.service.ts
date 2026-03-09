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
const MARGIN_LEFT     = 100;
const BUSBAR_Y        = 380;   // top of main busbar
const BUSBAR_H        = 20;
const ELEMENT_SPACING = 120;   // vertical gap between chain elements (center-to-center)
const FEEDER_SPACING  = 105;   // horizontal gap between feeder columns (reduced to fit 14 per page in 1600px)
const MIN_BUSBAR_W    = 600;

// ─── Element sizes (exact, matching SYMBOL_MAP rendering) ─────────────────
// Sizes tuned for SLD readability — larger symbols render properly at any zoom
const SIZES: Record<string, { w: number; h: number }> = {
  BusBar:               { w: 0,  h: 20  }, // width set dynamically
  DoubleBusBar:         { w: 0,  h: 30  },
  BusSection:           { w: 50, h: 30  },
  VacuumCB:             { w: 60, h: 60  },
  SF6CB:                { w: 60, h: 60  },
  ACB:                  { w: 60, h: 60  },
  CB:                   { w: 60, h: 60  },
  MCCB:                 { w: 50, h: 50  },
  MCB:                  { w: 45, h: 50  },
  RCCB:                 { w: 50, h: 50  },
  Fuse:                 { w: 40, h: 55  },
  Contactor:            { w: 50, h: 50  },
  Isolator:             { w: 60, h: 35  },
  EarthSwitch:          { w: 45, h: 45  },
  LoadBreakSwitch:      { w: 55, h: 45  },
  AutoRecloser:         { w: 55, h: 60  },
  RingMainUnit:         { w: 80, h: 80  },
  GIS:                  { w: 80, h: 80  },
  Transformer:          { w: 90, h: 110 },
  AutoTransformer:      { w: 90, h: 110 },
  InstrumentTransformer:{ w: 65, h: 75  },
  StepVoltageRegulator: { w: 75, h: 95  },
  CT:                   { w: 50, h: 38  },
  PT:                   { w: 50, h: 38  },
  Meter:                { w: 55, h: 55  },
  EnergyMeter:          { w: 55, h: 55  },
  LightningArrester:    { w: 40, h: 65  },
  Relay:                { w: 55, h: 55  },
  OvercurrentRelay:     { w: 55, h: 55  },
  EarthFaultRelay:      { w: 55, h: 55  },
  DifferentialRelay:    { w: 55, h: 55  },
  DistanceRelay:        { w: 55, h: 55  },
  Feeder:               { w: 55, h: 75  },
  GenericLoad:          { w: 65, h: 65  },
  ResistiveLoad:        { w: 65, h: 65  },
  InductiveLoad:        { w: 65, h: 65  },
  Motor:                { w: 65, h: 65  },
  Generator:            { w: 75, h: 75  },
  SolarInverter:        { w: 65, h: 65  },
  CapacitorBank:        { w: 65, h: 65  },
  ShuntReactor:         { w: 65, h: 75  },
  OverheadLine:         { w: 55, h: 55  },
  Cable:                { w: 55, h: 45  },
  Ground:               { w: 45, h: 40  },
  Junction:             { w: 12, h: 12  },
};

function elSize(type: string): { w: number; h: number } {
  return SIZES[type] || { w: 60, h: 60 };
}

/** Clean up AI-generated transformer labels — strip "0 MVA", fix truncated "kV" */
function cleanTransformerLabel(label: string): string {
  let l = label;
  // Remove "0 MVA " or "0MVA " prefix (AI sometimes sets MVA to 0)
  l = l.replace(/^0\s*MVA\s+/i, '');
  // Fix truncated voltage: "11/11k" → "11/11 kV", "33/11k" → "33/11 kV"
  l = l.replace(/(\d+)\s*\/\s*(\d+)\s*k\b(?!V)/i, '$1/$2 kV');
  // Fix missing space before kV: "11kV" → "11 kV"
  l = l.replace(/(\d)kV/gi, '$1 kV');
  return l.trim();
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
  _perPageIncomers?: TopoChain[][]; // per-page incomers (for multi-page layouts)
}

// ─── Placed element ────────────────────────────────────────────────────────
interface PlacedEl {
  id: string;
  type: string;
  x: number; y: number; width: number; height: number;
  rotation: number; zIndex: number;
  properties: Record<string, any>;
}

// Breaker types that default to CLOSED (system starts fully energized = all RED)
const BREAKER_TYPES_SET = new Set([
  'VacuumCB','SF6CB','ACB','CB','MCCB','MCB','RCCB','Fuse','Contactor',
  'LoadBreakSwitch','AutoRecloser','RingMainUnit','Isolator',
]);
const EARTH_SWITCH_TYPES = new Set(['EarthSwitch']);

function makeEl(uid: string, type: string, x: number, y: number, label: string, zIdx = 5, extra: Record<string, any> = {}): PlacedEl {
  const s = elSize(type);
  // Default breaker state: closed (energized) | earth switch: open (not grounded during operation)
  const defaultState = BREAKER_TYPES_SET.has(type) ? 'closed'
    : EARTH_SWITCH_TYPES.has(type) ? 'open'
    : undefined;
  return {
    id: uid, type,
    x: Math.round(x), y: Math.round(y),
    width: s.w, height: s.h,
    rotation: 0, zIndex: zIdx,
    properties: {
      label, showLabel: true, tagBindings: {},
      ...(defaultState ? { state: defaultState } : {}),
      ...extra,
    },
  };
}

function wire(fromId: string, toId: string, fromEl: PlacedEl, toEl: PlacedEl, color = '#374151', thick = 3) {
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

  // Compute column centers FIRST — then busbar spans them all
  const busbarX = MARGIN_LEFT;
  const busbarY = BUSBAR_Y;

  // Column center X: fixed FEEDER_SPACING between columns, starting from MARGIN_LEFT
  const colCenterX = (colIdx: number): number =>
    Math.round(busbarX + FEEDER_SPACING / 2 + colIdx * FEEDER_SPACING);

  // Busbar width = span all column centers + half FEEDER_SPACING on each side
  const computedBusbarWidth = totalCols > 0
    ? colCenterX(totalCols - 1) - busbarX + Math.round(FEEDER_SPACING / 2) + 20
    : MIN_BUSBAR_W;
  const busbarWidth = Math.max(MIN_BUSBAR_W, computedBusbarWidth);

  // Normalize busbar type
  const busNorm = normalizeType(topo.busbar?.type || 'BusBar');

  // Busbar voltage color label
  const voltageColors: Record<number, string> = { 132: '#1E40AF', 66: '#7C3AED', 33: '#DC2626', 11: '#16A34A', 6: '#D97706', 0.4: '#6B7280' };
  const busVoltage = topo.busbar?.voltage || 11;

  // Place main busbar — MUST use relX1/relY1/relX2/relY2 for line rendering
  // MimicEditor renders BusBar as: line from (x+relX1, y+relY1) to (x+relX2, y+relY2)
  // Without these props it falls back to SYMBOL_MAP foreignObject which renders at ~120px viewBox size
  const busbarUid = uuidv4();
  const busbarType = (busNorm.type === 'BusBar' || busNorm.type === 'DoubleBusBar') ? busNorm.type : 'BusBar';
  const busbarLineY = BUSBAR_H / 2; // center of element — the line runs horizontally through the middle
  const busbarEl: PlacedEl = {
    id: busbarUid,
    type: busbarType,
    x: busbarX, y: busbarY,
    width: busbarWidth, height: BUSBAR_H,
    rotation: 0, zIndex: 10,
    properties: {
      label: topo.busbar?.label || `${busVoltage}kV Busbar`,
      showLabel: true, tagBindings: {},
      voltageLevel: busVoltage,
      // Line rendering properties — REQUIRED for BusBar to render full-width
      relX1: 0,            // left end relative to element x
      relY1: busbarLineY,  // center of element height
      relX2: busbarWidth,  // right end relative to element x (= full width)
      relY2: busbarLineY,
      busWidth: busbarType === 'DoubleBusBar' ? 8 : 6,
      color: voltageColors[busVoltage] || '#16A34A',
      labelPosition: 'top',
    },
  };
  elements.push(busbarEl);

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
      properties: { label: cleanTransformerLabel(tr.label || 'Transformer'), showLabel: true, tagBindings: {} },
    };
    elements.push(trEl);

    // Wire busbar tap → transformer top (vertical)
    const tapX = cx;
    connections.push({
      id: uuidv4(), fromId: busbarUid, toId: trUid,
      points: [{ x: tapX, y: busbarY + BUSBAR_H / 2 }, { x: tapX, y: trY }],
      color: '#1d4ed8', thickness: 3,
    });

    // Add LV busbar below transformer if topology has one
    if (topo.lvBusbar) {
      const lvNorm   = normalizeType(topo.lvBusbar.type || 'BusBar');
      const lvY      = trY + size.h + Math.round(ELEMENT_SPACING * 0.6);
      const lvUid    = uuidv4();
      const lvBusW   = Math.max(300, feeders.length * FEEDER_SPACING);
      const lvBusX   = Math.round(cx - lvBusW / 2);

      const lvBusLineY = BUSBAR_H / 2;
      const lvVoltage = topo.lvBusbar.voltage || 0.4;
      const lvBusEl: PlacedEl = {
        id: lvUid, type: 'BusBar',
        x: lvBusX, y: lvY, width: lvBusW, height: BUSBAR_H,
        rotation: 0, zIndex: 9,
        properties: {
          label: topo.lvBusbar.label || `${lvVoltage}kV Busbar`,
          showLabel: true, tagBindings: {},
          voltageLevel: lvVoltage,
          labelPosition: 'top',
          // Line rendering properties — REQUIRED for BusBar to render full-width
          relX1: 0,
          relY1: lvBusLineY,
          relX2: lvBusW,
          relY2: lvBusLineY,
          busWidth: 6,
          color: voltageColors[lvVoltage] || '#6B7280',
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
        color: '#16a34a', thickness: 3,
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
      // Bottom-most element of incomer chain — wire down to busbar center line
      const fx = Math.round(pEl.x + pEl.width  / 2);
      const fy = pEl.y + pEl.height;
      const ty = busbarY + BUSBAR_H / 2; // tap onto the center line of the busbar
      connections.push({
        id: uuidv4(), fromId: uid, toId: busbarUid,
        points: [{ x: fx, y: fy }, { x: fx, y: ty }],
        color: '#374151', thickness: 3,
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
      // Top-most element of feeder chain — wire from busbar center line tap
      const tx = Math.round(pEl.x + pEl.width / 2);
      const ty = pEl.y;
      const busbarCenterY = busbarBottom - BUSBAR_H / 2; // center of busbar line
      connections.push({
        id: uuidv4(), fromId: busbarUid, toId: uid,
        points: [{ x: tx, y: busbarCenterY }, { x: tx, y: ty }],
        color: '#374151', thickness: 3,
      });
    }
  }

  // Wire consecutive elements (top-down)
  for (let k = 0; k < placed.length - 1; k++) {
    connections.push(wire(placed[k].id, placed[k + 1].id, placed[k], placed[k + 1]));
  }
}

// ─── Multi-page layout splitter ──────────────────────────────────────────────
// Splits feeders across N pages so each page fits within CANVAS_W × CANVAS_H.
// Each page gets the full incomer chain + busbar + a subset of feeders.

export function layoutSubstationMultiPage(
  topo: SubstationTopology,
  numPages: number,
  feedersPerPageOverride?: number    // explicit feeders-per-page from user instructions
): Array<{ name: string; elements: PlacedEl[]; connections: any[] }> {
  const feeders = topo.feeders || [];
  const incomers = topo.incomers || [];

  // If caller provides numPages > 1, treat it as a hard limit (user-specified).
  // Calculate feedersPerPage to fit all feeders into exactly numPages pages.
  let feedersPerPage: number;
  if (numPages > 1 && feedersPerPageOverride) {
    // Both specified — honour feedersPerPage, but cap pages at numPages
    feedersPerPage = feedersPerPageOverride;
  } else if (numPages > 1) {
    // Page count specified, no feeders-per-page — spread evenly
    feedersPerPage = Math.ceil(feeders.length / numPages);
  } else if (feedersPerPageOverride) {
    // Only feeders-per-page specified — auto pages
    feedersPerPage = feedersPerPageOverride;
  } else {
    // Nothing specified — auto from canvas width
    feedersPerPage = Math.max(1, Math.floor((CANVAS_W - MARGIN_LEFT) / FEEDER_SPACING) - 1);
  }
  // pages = exactly what caller asked for (already computed in service.ts)
  const pages = numPages;
  const result: Array<{ name: string; elements: PlacedEl[]; connections: any[] }> = [];

  for (let p = 0; p < pages; p++) {
    const pageStart = p * feedersPerPage;
    const pageFeeders = feeders.slice(pageStart, pageStart + feedersPerPage);
    if (pageFeeders.length === 0 && p > 0) continue;

    // Build a per-page topology with the same busbar but this page's feeders + incomers
    // If per-page incomers are available, use them; otherwise incomers on page 0 only
    const pageIncomers = topo._perPageIncomers && topo._perPageIncomers[p]
      ? topo._perPageIncomers[p]
      : (p === 0 ? incomers : []);
    const pageTopo: SubstationTopology = {
      ...topo,
      incomers: pageIncomers,
      feeders: pageFeeders,
      transformers: p === 0 ? (topo.transformers || []) : [],
    };

    const { elements, connections } = layoutSubstation(pageTopo);
    const baseName = topo.name || 'AI Generated SLD';
    result.push({
      name: pages > 1 ? `${baseName} - Page ${p + 1}` : baseName,
      elements,
      connections,
    });
  }

  return result;
}
