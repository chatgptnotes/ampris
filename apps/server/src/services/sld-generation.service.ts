import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maps AI type names to GridVision's actual symbol types + sizes
const TYPE_MAP: Record<string, { type: string; w: number; h: number }> = {
  CIRCUIT_BREAKER:       { type: 'CB',               w: 40,  h: 40  },
  VACUUM_CB:             { type: 'VacuumCB',          w: 40,  h: 40  },
  SF6_CB:                { type: 'SF6CB',             w: 40,  h: 40  },
  ISOLATOR:              { type: 'Isolator',          w: 40,  h: 25  },
  EARTH_SWITCH:          { type: 'EarthSwitch',       w: 30,  h: 30  },
  POWER_TRANSFORMER:     { type: 'Transformer',       w: 70,  h: 90  },
  CURRENT_TRANSFORMER:   { type: 'CT',                w: 35,  h: 25  },
  POTENTIAL_TRANSFORMER: { type: 'PT',                w: 35,  h: 25  },
  BUS_BAR:               { type: 'BusBar',            w: 800, h: 8   },
  FEEDER:                { type: 'Feeder',            w: 40,  h: 60  },
  FEEDER_LINE:           { type: 'Feeder',            w: 40,  h: 60  },
  LIGHTNING_ARRESTER:    { type: 'LightningArrester', w: 30,  h: 50  },
  CAPACITOR_BANK:        { type: 'CapacitorBank',     w: 50,  h: 50  },
  CABLE:                 { type: 'Cable',             w: 80,  h: 8   },
  OVERHEAD_LINE:         { type: 'OverheadLine',      w: 100, h: 20  },
  METER:                 { type: 'Meter',             w: 40,  h: 40  },
  CT:                    { type: 'CT',                w: 35,  h: 25  },
  PT:                    { type: 'PT',                w: 35,  h: 25  },
};

function normalizeType(t: string): { type: string; w: number; h: number } {
  const u = (t || '').toUpperCase().replace(/[-\s]/g, '_');
  if (TYPE_MAP[u]) return TYPE_MAP[u];
  if (u.includes('BREAKER') || u.includes('CB') || u.includes('VCB') || u.includes('ACB')) return TYPE_MAP.CIRCUIT_BREAKER;
  if (u.includes('TRANSFORM') || u.includes('XFMR') || u.includes('AVR')) return TYPE_MAP.POWER_TRANSFORMER;
  if (u.includes('BUS')) return TYPE_MAP.BUS_BAR;
  if (u.includes('FEEDER') || u.includes('OUTGOING')) return TYPE_MAP.FEEDER;
  if (u.includes('ISOLAT') || u.includes('DISCONN')) return TYPE_MAP.ISOLATOR;
  if (u.includes('EARTH') || u.includes('GROUND')) return TYPE_MAP.EARTH_SWITCH;
  if (u.includes('CT') || u.includes('CURRENT_T')) return TYPE_MAP.CT;
  if (u.includes('PT') || u.includes('POTENTIAL') || u.includes('VT')) return TYPE_MAP.PT;
  if (u.includes('ARRESTER') || u.includes('SURGE')) return TYPE_MAP.LIGHTNING_ARRESTER;
  return TYPE_MAP.FEEDER;
}

export async function generateSLDFromImage(imageBuffer: Buffer, mimeType: string) {
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const userPrompt = `You are analyzing an electrical Single Line Diagram (SLD). Extract the complete topology and layout.

Return JSON with this structure:
{
  "name": "substation name",
  "voltage_levels": ["33kV", "11kV"],
  "busbars": [
    { "id": "bb1", "label": "33kV Busbar", "voltage": 33, "x_pct": 50, "y_pct": 15 },
    { "id": "bb2", "label": "11kV Busbar", "voltage": 11, "x_pct": 50, "y_pct": 35 }
  ],
  "components": [
    {
      "id": "t1",
      "type": "POWER_TRANSFORMER",
      "label": "TR-1 10MVA 33/11kV",
      "x_pct": 20,
      "y_pct": 25,
      "connected_to": ["bb1", "bb2"]
    },
    {
      "id": "cb1",
      "type": "CIRCUIT_BREAKER",
      "label": "VCB-1",
      "x_pct": 30,
      "y_pct": 45,
      "connected_to": ["bb2", "f1"]
    },
    {
      "id": "f1",
      "type": "FEEDER",
      "label": "Feeder-1 FBC",
      "x_pct": 30,
      "y_pct": 60,
      "connected_to": ["cb1"]
    }
  ],
  "connections": [
    { "from": "bb1", "to": "t1" },
    { "from": "t1", "to": "bb2" },
    { "from": "bb2", "to": "cb1" },
    { "from": "cb1", "to": "f1" }
  ]
}

Rules:
- x_pct and y_pct are percentage positions (0-100) representing WHERE each component appears in the original diagram
- Match positions to the actual diagram layout as closely as possible
- busbars are horizontal lines spanning the diagram width
- List ALL components visible: every transformer, breaker, feeder, CT, PT, arrester
- connections list every wire/line between components
- type must be: BUS_BAR, POWER_TRANSFORMER, CIRCUIT_BREAKER, ISOLATOR, EARTH_SWITCH, CT, PT, FEEDER, FEEDER_LINE, LIGHTNING_ARRESTER, CAPACITOR_BANK, OVERHEAD_LINE, CABLE

Return ONLY valid JSON, no markdown.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        { type: 'text', text: userPrompt },
      ],
    }],
  });

  const textContent = response.choices[0]?.message?.content || '';
  console.log('[SLD] Response length:', textContent.length);

  let jsonStr = textContent.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) jsonStr = fence[1].trim();
  const jMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jMatch) jsonStr = jMatch[0];

  let parsed: any;
  try { parsed = JSON.parse(jsonStr); }
  catch { throw new Error('Failed to parse AI response: ' + textContent.substring(0, 200)); }

  // Canvas size
  const CW = 1920, CH = 1080;
  const MARGIN_X = 80, MARGIN_Y = 80;
  const USABLE_W = CW - MARGIN_X * 2;
  const USABLE_H = CH - MARGIN_Y * 2;

  const elements: any[] = [];
  const connections: any[] = [];
  const idMap = new Map<string, string>(); // AI id -> element uuid

  // Place busbars
  const busbars: any[] = parsed.busbars || [];
  for (const bb of busbars) {
    const sym = TYPE_MAP.BUS_BAR;
    const uid = uuidv4();
    idMap.set(bb.id, uid);
    const cx = MARGIN_X + (bb.x_pct / 100) * USABLE_W;
    const y  = MARGIN_Y + (bb.y_pct / 100) * USABLE_H;
    const w  = USABLE_W * 0.9;
    elements.push({
      id: uid, type: sym.type,
      x: Math.round(MARGIN_X + USABLE_W * 0.05), y: Math.round(y),
      width: Math.round(w), height: sym.h,
      rotation: 0, zIndex: 1,
      properties: { tagBindings: {}, label: bb.label || '', showLabel: true, labelPosition: 'top', voltageLevel: bb.voltage || 11 },
    });
  }

  // Place components
  const comps: any[] = parsed.components || [];
  for (const comp of comps) {
    const sym = normalizeType(comp.type);
    const uid = uuidv4();
    idMap.set(comp.id, uid);
    const cx = MARGIN_X + (comp.x_pct / 100) * USABLE_W;
    const cy = MARGIN_Y + (comp.y_pct / 100) * USABLE_H;
    elements.push({
      id: uid, type: sym.type,
      x: Math.round(cx - sym.w / 2), y: Math.round(cy - sym.h / 2),
      width: sym.w, height: sym.h,
      rotation: 0, zIndex: 2,
      properties: { tagBindings: {}, label: comp.label || '', showLabel: true, labelPosition: 'bottom' },
    });
  }

  // Build connections from AI connection list
  const aiConns: any[] = parsed.connections || [];
  for (const c of aiConns) {
    const fromUid = idMap.get(c.from);
    const toUid   = idMap.get(c.to);
    if (!fromUid || !toUid) continue;
    const fromEl = elements.find(e => e.id === fromUid);
    const toEl   = elements.find(e => e.id === toUid);
    if (!fromEl || !toEl) continue;

    // Compute wire points
    const fx = fromEl.x + fromEl.width  / 2;
    const fy = fromEl.y + fromEl.height;
    const tx = toEl.x   + toEl.width    / 2;
    const ty = toEl.y;
    const midY = (fy + ty) / 2;

    // If same x, straight line; else L-shape
    const pts = fx === tx
      ? [{ x: fx, y: fy }, { x: tx, y: ty }]
      : [{ x: fx, y: fy }, { x: fx, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }];

    connections.push({
      id: uuidv4(), fromId: fromUid, toId: toUid,
      points: pts, color: '#374151', thickness: 2,
    });
  }

  console.log(`[SLD] Generated: ${elements.length} elements, ${connections.length} connections`);
  if (elements.length === 0) throw new Error('No elements detected in diagram');

  return {
    id: uuidv4(), substationId: uuidv4(),
    name: parsed.name || 'AI Generated SLD',
    width: CW, height: CH,
    elements, connections,
  };
}
