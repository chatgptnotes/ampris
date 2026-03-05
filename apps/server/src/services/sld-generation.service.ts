import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maps AI type names to GridVision's actual symbol types
const TYPE_MAP: Record<string, { type: string; w: number; h: number }> = {
  CIRCUIT_BREAKER:       { type: 'CB',                  w: 60,  h: 60  },
  ISOLATOR:              { type: 'Isolator',             w: 60,  h: 40  },
  EARTH_SWITCH:          { type: 'EarthSwitch',          w: 50,  h: 50  },
  POWER_TRANSFORMER:     { type: 'Transformer',          w: 80,  h: 100 },
  CURRENT_TRANSFORMER:   { type: 'CT',                   w: 50,  h: 40  },
  POTENTIAL_TRANSFORMER: { type: 'PT',                   w: 50,  h: 40  },
  BUS_BAR:               { type: 'BusBar',               w: 300, h: 10  },
  FEEDER_LINE:           { type: 'Feeder',               w: 60,  h: 80  },
  LIGHTNING_ARRESTER:    { type: 'LightningArrester',    w: 40,  h: 60  },
  CAPACITOR_BANK:        { type: 'CapacitorBank',        w: 60,  h: 60  },
  VACUUM_CB:             { type: 'VacuumCB',             w: 60,  h: 60  },
  SF6_CB:                { type: 'SF6CB',                w: 60,  h: 60  },
  OVERHEAD_LINE:         { type: 'OverheadLine',         w: 120, h: 30  },
  CABLE:                 { type: 'Cable',                w: 100, h: 10  },
  GENERATOR:             { type: 'Generator',            w: 70,  h: 70  },
  MOTOR:                 { type: 'Motor',                w: 70,  h: 70  },
  METER:                 { type: 'Meter',                w: 60,  h: 60  },
};

function normalizeType(t: string): { type: string; w: number; h: number } {
  const u = (t || '').toUpperCase().replace(/[-\s]/g, '_');
  if (TYPE_MAP[u]) return TYPE_MAP[u];
  // Partial match
  for (const [k, v] of Object.entries(TYPE_MAP)) {
    if (u.includes(k) || k.includes(u)) return v;
  }
  // Keyword match
  if (u.includes('BREAKER') || u.includes('CB')) return TYPE_MAP.CIRCUIT_BREAKER;
  if (u.includes('TRANSFORM') || u.includes('XFMR')) return TYPE_MAP.POWER_TRANSFORMER;
  if (u.includes('BUS')) return TYPE_MAP.BUS_BAR;
  if (u.includes('FEEDER') || u.includes('LINE') || u.includes('CABLE')) return TYPE_MAP.FEEDER_LINE;
  if (u.includes('ISOLAT')) return TYPE_MAP.ISOLATOR;
  if (u.includes('EARTH') || u.includes('GROUND')) return TYPE_MAP.EARTH_SWITCH;
  return TYPE_MAP.FEEDER_LINE;
}

export async function generateSLDFromImage(imageBuffer: Buffer, mimeType: string) {
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const userPrompt = `Analyze this electrical Single Line Diagram (SLD) and extract all components.

Return a JSON object with this EXACT structure — a proper SLD layout with busbars at top, components below:

{
  "name": "Substation name from diagram",
  "elements": [
    {
      "type": "BUS_BAR",
      "label": "11kV Main Busbar",
      "row": 0,
      "col": 0,
      "span": 8
    },
    {
      "type": "POWER_TRANSFORMER",
      "label": "TR-1 10MVA 33/11kV",
      "row": 1,
      "col": 0
    },
    {
      "type": "CIRCUIT_BREAKER",
      "label": "VCB-1",
      "row": 2,
      "col": 0
    }
  ]
}

Rules:
- row=0: main busbars (horizontal, full width)
- row=1: primary equipment connected to busbar (transformers, incoming feeders)
- row=2: circuit breakers / isolators below transformers
- row=3: outgoing feeders
- col: column position (0=leftmost)
- span: for busbars, how many columns it spans (omit for other elements)
- type must be one of: BUS_BAR, POWER_TRANSFORMER, CIRCUIT_BREAKER, ISOLATOR, EARTH_SWITCH, CURRENT_TRANSFORMER, POTENTIAL_TRANSFORMER, FEEDER_LINE, LIGHTNING_ARRESTER, CAPACITOR_BANK
- Include ALL visible components with their exact labels

Return ONLY the JSON, no markdown.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        { type: 'text', text: userPrompt },
      ],
    }],
  });

  const textContent = response.choices[0]?.message?.content || '';
  console.log('[SLD] OpenAI response length:', textContent.length);

  let jsonStr = textContent.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse OpenAI response as JSON: ' + textContent.substring(0, 200));
  }

  const rawElements: any[] = parsed.elements || [];
  if (rawElements.length === 0) throw new Error('No elements detected in diagram');

  // Layout constants
  const COL_W = 160;   // pixels per column
  const ROW_H = 140;   // pixels per row
  const MARGIN_X = 80;
  const MARGIN_Y = 60;
  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  // Count max cols
  const maxCol = Math.max(...rawElements.filter(e => e.type !== 'BUS_BAR').map(e => e.col ?? 0));
  const totalCols = Math.max(maxCol + 1, 6);

  const elements: any[] = [];
  const connections: any[] = [];

  // Place elements on grid
  for (const raw of rawElements) {
    const sym = normalizeType(raw.type);
    const col = raw.col ?? 0;
    const row = raw.row ?? 1;
    const span = raw.span ?? 1;

    let x: number, y: number, w: number, h: number;

    if (raw.type === 'BUS_BAR' || sym.type === 'BusBar') {
      // Busbar spans full width
      w = span > 1 ? span * COL_W : totalCols * COL_W;
      h = 12;
      x = MARGIN_X;
      y = MARGIN_Y + row * ROW_H;
    } else {
      w = sym.w;
      h = sym.h;
      x = MARGIN_X + col * COL_W + Math.round((COL_W - w) / 2);
      y = MARGIN_Y + row * ROW_H + Math.round((ROW_H - h) / 2);
    }

    const id = uuidv4();
    elements.push({
      id,
      elementType: sym.type,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex: row,
      properties: {
        tagBindings: {},
        label: raw.label || '',
        showLabel: true,
        labelPosition: sym.type === 'BusBar' ? 'top' : 'bottom',
      },
      _col: col,
      _row: row,
      _type: raw.type,
    });
  }

  // Helper: center-bottom point of an element
  function bottomCenter(el: any) { return { x: el.x + el.width / 2, y: el.y + el.height }; }
  function topCenter(el: any)    { return { x: el.x + el.width / 2, y: el.y }; }

  function makeConn(fromEl: any, toEl: any, color = '#374151') {
    const from = bottomCenter(fromEl);
    const to   = topCenter(toEl);
    const midY = (from.y + to.y) / 2;
    return {
      id: uuidv4(),
      fromId: fromEl.id,
      toId: toEl.id,
      points: [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to],
      color,
      thickness: 2,
    };
  }

  const busbars = elements.filter(e => e.elementType === 'BusBar');
  const others  = elements.filter(e => e.elementType !== 'BusBar');

  // Busbar → equipment directly below (same column)
  for (const busbar of busbars) {
    const busRow = busbar._row;
    const below  = others.filter(e => e._row === busRow + 1);
    for (const el of below) {
      const fromPt = { x: el.x + el.width / 2, y: busbar.y + busbar.height };
      const toPt   = topCenter(el);
      connections.push({
        id: uuidv4(), fromId: busbar.id, toId: el.id,
        points: [fromPt, toPt], color: '#374151', thickness: 2,
      });
    }
  }

  // Within-column: row N → row N+1
  for (let c = 0; c <= maxCol; c++) {
    const colEls = others.filter(e => e._col === c).sort((a: any, b: any) => a._row - b._row);
    for (let i = 0; i < colEls.length - 1; i++) {
      connections.push(makeConn(colEls[i], colEls[i + 1]));
    }
  }

  // Clean up internal props
  for (const el of elements) {
    delete el._col;
    delete el._row;
    delete el._type;
  }

  console.log(`[SLD] Schema validation passed — elements: ${elements.length}`);

  return {
    id: uuidv4(),
    substationId: uuidv4(),
    name: parsed.name || 'AI Generated SLD',
    width: CANVAS_W,
    height: CANVAS_H,
    elements,
    connections,
  };
}
