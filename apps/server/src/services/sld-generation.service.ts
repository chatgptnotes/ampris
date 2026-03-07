import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL      = 'claude-sonnet-4-6';

const TYPE_MAP: Record<string, { type: string; w: number; h: number }> = {
  CIRCUIT_BREAKER:       { type: 'CB',               w: 40, h: 40 },
  VACUUM_CB:             { type: 'VacuumCB',          w: 40, h: 40 },
  ISOLATOR:              { type: 'Isolator',          w: 40, h: 25 },
  EARTH_SWITCH:          { type: 'EarthSwitch',       w: 30, h: 30 },
  POWER_TRANSFORMER:     { type: 'Transformer',       w: 70, h: 90 },
  CURRENT_TRANSFORMER:   { type: 'CT',                w: 35, h: 25 },
  POTENTIAL_TRANSFORMER: { type: 'PT',                w: 35, h: 25 },
  BUS_BAR:               { type: 'BusBar',            w: 0,  h: 10 },
  FEEDER:                { type: 'Feeder',            w: 40, h: 60 },
  FEEDER_LINE:           { type: 'Feeder',            w: 40, h: 60 },
  LIGHTNING_ARRESTER:    { type: 'LightningArrester', w: 30, h: 50 },
  CAPACITOR_BANK:        { type: 'CapacitorBank',     w: 50, h: 50 },
  OVERHEAD_LINE:         { type: 'OverheadLine',      w: 80, h: 20 },
  CABLE:                 { type: 'Cable',             w: 80, h: 8  },
  METER:                 { type: 'Meter',             w: 40, h: 40 },
};

function normalizeType(t: string): { type: string; w: number; h: number } {
  const u = (t || '').toUpperCase().replace(/[-\s]/g, '_');
  if (TYPE_MAP[u]) return { ...TYPE_MAP[u] };
  if (u.includes('BREAKER') || u.includes('VCB') || u.includes('ACB') || u.includes('_CB') || u === 'CB') return { ...TYPE_MAP.CIRCUIT_BREAKER };
  if (u.includes('TRANSFORM') || u.includes('XFMR') || u.includes('AVR') || u.includes('MVA') || u.includes('KVA')) return { ...TYPE_MAP.POWER_TRANSFORMER };
  if (u.includes('BUS')) return { ...TYPE_MAP.BUS_BAR };
  if (u.includes('FEEDER') || u.includes('OUTGOING') || u.includes('INCOMING') || u.includes('PANEL')) return { ...TYPE_MAP.FEEDER };
  if (u.includes('ISOLAT') || u.includes('DISCONN')) return { ...TYPE_MAP.ISOLATOR };
  if (u.includes('EARTH') || u.includes('GROUND')) return { ...TYPE_MAP.EARTH_SWITCH };
  if (u.includes('ARRESTER') || u.includes('SURGE')) return { ...TYPE_MAP.LIGHTNING_ARRESTER };
  if (u.includes('METER') || u.includes('METERING')) return { ...TYPE_MAP.METER };
  if (u.includes('OVERHEAD') || u.includes('LINE') || u.includes('INCOMING')) return { ...TYPE_MAP.OVERHEAD_LINE };
  return { ...TYPE_MAP.FEEDER };
}

function claudeRequest(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.content?.[0]?.text || '';
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function generateSLDFromImage(imageBuffer: Buffer, mimeType: string) {
  const base64Image = imageBuffer.toString('base64');

  const prompt = `You are an expert electrical engineer. Analyze this Single Line Diagram (SLD) carefully.

Extract EVERY electrical component with exact labels from the diagram.

Return ONLY valid JSON (no markdown, no explanation):
{
  "name": "substation name from diagram",
  "components": [
    {
      "id": "c1",
      "type": "OVERHEAD_LINE | BUS_BAR | POWER_TRANSFORMER | CIRCUIT_BREAKER | ISOLATOR | EARTH_SWITCH | CT | PT | FEEDER | LIGHTNING_ARRESTER | CAPACITOR_BANK | METER",
      "label": "exact label from diagram e.g. MADGI, 10 MVA 33/11KV, VCB-1, FBC",
      "voltage": 33,
      "level": 0,
      "column": 0
    }
  ],
  "connections": [
    { "from": "c1", "to": "c2" }
  ]
}

Level assignment (vertical position, top to bottom):
- level 0: incoming grid lines (MADGI, KARDHA etc.)
- level 1: HV busbar (33kV, 132kV etc.)
- level 2: power transformers
- level 3: LV busbar (11kV, 415V etc.)
- level 4: outgoing circuit breakers / isolators
- level 5: outgoing feeders / panels / loads

Column assignment: each parallel branch gets its own column (0, 1, 2, 3...)

CRITICAL: 
- Include ALL transformers (look for MVA ratings, transformer symbols)
- Include ALL busbars at each voltage level
- Include ALL outgoing feeders with their names
- Set voltage field for each component
- List ALL connections between components

Return ONLY the JSON object.`;

  console.log(`[SLD] Calling Claude ${CLAUDE_MODEL}...`);
  const textContent = await claudeRequest(base64Image, mimeType, prompt);
  console.log('[SLD] Response length:', textContent.length);

  let jsonStr = textContent.trim();
  // Strip leading "json" word if Gemini returns without proper fences
  jsonStr = jsonStr.replace(/^json\s*/i, '');
  // Strip markdown fences
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) jsonStr = fence[1].trim();
  // Extract first {...} block
  const jMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jMatch) jsonStr = jMatch[0];

  let parsed: any;
  try { parsed = JSON.parse(jsonStr); }
  catch (e: any) {
    // Try to fix truncated JSON by finding last valid closing brace
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try { parsed = JSON.parse(jsonStr.substring(0, lastBrace + 1)); }
      catch { throw new Error('Failed to parse Gemini response: ' + textContent.substring(0, 300)); }
    } else {
      throw new Error('Failed to parse Gemini response: ' + textContent.substring(0, 300));
    }
  }

  const comps: any[] = parsed.components || [];
  if (comps.length === 0) throw new Error('No components detected');
  console.log('[SLD] Components detected:', comps.length);

  // Layout engine
  const CANVAS_W = 1600, CANVAS_H = 900;
  const MARGIN = 60, USABLE_W = CANVAS_W - MARGIN * 2;
  const LEVEL_H = 130;

  const byLevel = new Map<number, any[]>();
  for (const c of comps) {
    const lv = Number(c.level ?? 0);
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(c);
  }
  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);

  const elements: any[] = [];
  const idMap = new Map<string, string>();

  for (const lv of levels) {
    const group = byLevel.get(lv)!.sort((a: any, b: any) => (a.column ?? 0) - (b.column ?? 0));
    const colCount = Math.max(...group.map((c: any) => Number(c.column ?? 0))) + 1;
    const colW = USABLE_W / Math.max(colCount, 1);
    const y = MARGIN + lv * LEVEL_H;

    for (let i = 0; i < group.length; i++) {
      const comp = group[i];
      const sym = normalizeType(comp.type);
      const uid = uuidv4();
      idMap.set(comp.id, uid);

      let x: number, w: number, h: number;

      if (sym.type === 'BusBar') {
        x = MARGIN; w = USABLE_W; h = sym.h;
      } else {
        const col = Number(comp.column ?? i);
        const cx = MARGIN + col * colW + colW / 2;
        w = sym.w; h = sym.h;
        x = Math.round(cx - w / 2);
      }

      x = Math.max(MARGIN, Math.min(CANVAS_W - w - MARGIN, x));
      const cy = Math.max(MARGIN, Math.min(CANVAS_H - h - 20, y));

      elements.push({
        id: uid, type: sym.type,
        x: Math.round(x), y: Math.round(cy),
        width: w, height: h,
        rotation: 0, zIndex: lv + 1,
        properties: {
          tagBindings: {}, label: comp.label || '',
          showLabel: true,
          labelPosition: sym.type === 'BusBar' ? 'top' : 'bottom',
          voltageLevel: comp.voltage,
        },
      });
    }
  }

  const connections: any[] = [];
  for (const conn of (parsed.connections || [])) {
    const fromUid = idMap.get(conn.from), toUid = idMap.get(conn.to);
    if (!fromUid || !toUid) continue;
    const fromEl = elements.find(e => e.id === fromUid);
    const toEl   = elements.find(e => e.id === toUid);
    if (!fromEl || !toEl) continue;

    const [topEl, botEl] = fromEl.y <= toEl.y ? [fromEl, toEl] : [toEl, fromEl];
    const [topUid, botUid] = fromEl.y <= toEl.y ? [fromUid, toUid] : [toUid, fromUid];
    const fx = Math.round(topEl.x + topEl.width / 2), fy = Math.round(topEl.y + topEl.height);
    const tx = Math.round(botEl.x + botEl.width / 2), ty = Math.round(botEl.y);
    const midY = Math.round((fy + ty) / 2);
    const pts = fx === tx ? [{x:fx,y:fy},{x:tx,y:ty}] : [{x:fx,y:fy},{x:fx,y:midY},{x:tx,y:midY},{x:tx,y:ty}];
    connections.push({ id: uuidv4(), fromId: topUid, toId: botUid, points: pts, color: '#374151', thickness: 2 });
  }

  console.log(`[SLD] Done: ${elements.length} elements, ${connections.length} connections`);
  return {
    id: uuidv4(), substationId: uuidv4(),
    name: parsed.name || 'AI Generated SLD',
    width: CANVAS_W, height: CANVAS_H,
    elements, connections,
  };
}
