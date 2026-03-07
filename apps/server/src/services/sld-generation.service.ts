import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import * as https from 'https';
import { env } from '../config/environment';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL      = 'claude-opus-4-6';

// SYMBOL_MAP must exactly match the frontend MimicEditor SYMBOL_MAP keys
const TYPE_MAP: Record<string, { type: string; w: number; h: number }> = {
  // Switchgear
  CB:                    { type: 'CB',               w: 40, h: 40 },
  CIRCUIT_BREAKER:       { type: 'CB',               w: 40, h: 40 },
  VCB:                   { type: 'VacuumCB',         w: 40, h: 40 },
  VACUUM_CB:             { type: 'VacuumCB',         w: 40, h: 40 },
  VACUUMCB:              { type: 'VacuumCB',         w: 40, h: 40 },
  SF6CB:                 { type: 'SF6CB',            w: 40, h: 40 },
  SF6_CB:                { type: 'SF6CB',            w: 40, h: 40 },
  ACB:                   { type: 'ACB',              w: 40, h: 40 },
  MCCB:                  { type: 'MCCB',             w: 35, h: 35 },
  MCB:                   { type: 'MCB',              w: 30, h: 35 },
  RCCB:                  { type: 'RCCB',             w: 35, h: 35 },
  ISOLATOR:              { type: 'Isolator',         w: 40, h: 25 },
  DISCONNECTOR:          { type: 'Isolator',         w: 40, h: 25 },
  EARTH_SWITCH:          { type: 'EarthSwitch',      w: 30, h: 30 },
  LOAD_BREAK_SWITCH:     { type: 'LoadBreakSwitch',  w: 40, h: 30 },
  LBS:                   { type: 'LoadBreakSwitch',  w: 40, h: 30 },
  AUTO_RECLOSER:         { type: 'AutoRecloser',     w: 40, h: 45 },
  RING_MAIN_UNIT:        { type: 'RingMainUnit',     w: 60, h: 60 },
  RMU:                   { type: 'RingMainUnit',     w: 60, h: 60 },
  GIS:                   { type: 'GIS',              w: 60, h: 60 },
  FUSE:                  { type: 'Fuse',             w: 30, h: 40 },
  CONTACTOR:             { type: 'Contactor',        w: 35, h: 35 },
  // Transformers
  POWER_TRANSFORMER:     { type: 'Transformer',      w: 70, h: 90 },
  TRANSFORMER:           { type: 'Transformer',      w: 70, h: 90 },
  AUTO_TRANSFORMER:      { type: 'AutoTransformer',  w: 70, h: 90 },
  INSTRUMENT_TRANSFORMER:{ type: 'InstrumentTransformer', w: 50, h: 60 },
  STEP_VOLTAGE_REGULATOR:{ type: 'StepVoltageRegulator',  w: 60, h: 80 },
  // Busbars & Lines
  BUS_BAR:               { type: 'BusBar',           w: 0,  h: 10 },
  BUSBAR:                { type: 'BusBar',           w: 0,  h: 10 },
  DOUBLE_BUSBAR:         { type: 'DoubleBusBar',     w: 0,  h: 20 },
  BUS_SECTION:           { type: 'BusSection',       w: 40, h: 25 },
  CABLE:                 { type: 'Cable',            w: 80, h: 8  },
  OVERHEAD_LINE:         { type: 'OverheadLine',     w: 80, h: 20 },
  UNDERGROUND_CABLE:     { type: 'UndergroundCable', w: 80, h: 12 },
  // Measurement
  CT:                    { type: 'CT',               w: 35, h: 25 },
  CURRENT_TRANSFORMER:   { type: 'CT',               w: 35, h: 25 },
  PT:                    { type: 'PT',               w: 35, h: 25 },
  POTENTIAL_TRANSFORMER: { type: 'PT',               w: 35, h: 25 },
  VT:                    { type: 'PT',               w: 35, h: 25 },
  METER:                 { type: 'Meter',            w: 40, h: 40 },
  ENERGY_METER:          { type: 'EnergyMeter',      w: 40, h: 40 },
  // Protection
  LIGHTNING_ARRESTER:    { type: 'LightningArrester',w: 30, h: 50 },
  SURGE_ARRESTER:        { type: 'LightningArrester',w: 30, h: 50 },
  LA:                    { type: 'LightningArrester',w: 30, h: 50 },
  RELAY:                 { type: 'Relay',            w: 40, h: 40 },
  OVERCURRENT_RELAY:     { type: 'OvercurrentRelay', w: 40, h: 40 },
  EARTH_FAULT_RELAY:     { type: 'EarthFaultRelay',  w: 40, h: 40 },
  DIFFERENTIAL_RELAY:    { type: 'DifferentialRelay',w: 40, h: 40 },
  DISTANCE_RELAY:        { type: 'DistanceRelay',    w: 40, h: 40 },
  // Loads
  FEEDER:                { type: 'Feeder',           w: 40, h: 60 },
  LOAD:                  { type: 'GenericLoad',      w: 50, h: 50 },
  GENERIC_LOAD:          { type: 'GenericLoad',      w: 50, h: 50 },
  RESISTIVE_LOAD:        { type: 'ResistiveLoad',    w: 50, h: 50 },
  INDUCTIVE_LOAD:        { type: 'InductiveLoad',    w: 50, h: 50 },
  MOTOR:                 { type: 'Motor',            w: 50, h: 50 },
  GENERATOR:             { type: 'Generator',        w: 60, h: 60 },
  // Power Electronics
  CAPACITOR_BANK:        { type: 'CapacitorBank',    w: 50, h: 50 },
  SHUNT_REACTOR:         { type: 'ShuntReactor',     w: 50, h: 60 },
  VFD:                   { type: 'VFD',              w: 50, h: 50 },
  UPS:                   { type: 'UPSDetail',        w: 50, h: 60 },
  SOLAR_PANEL:           { type: 'SolarPanel',       w: 60, h: 40 },
  SOLAR_INVERTER:        { type: 'SolarInverter',    w: 50, h: 50 },
  BATTERY:               { type: 'Battery',          w: 40, h: 60 },
  WIND_TURBINE:          { type: 'WindTurbine',      w: 60, h: 80 },
  // Misc
  JUNCTION:              { type: 'Junction',         w: 10, h: 10 },
  GROUND:                { type: 'Ground',           w: 30, h: 30 },
  PANEL:                 { type: 'Panel',            w: 60, h: 70 },
  MCC:                   { type: 'MCC',              w: 60, h: 70 },
};

function normalizeType(t: string): { type: string; w: number; h: number } {
  const u = (t || '').toUpperCase().replace(/[-\s.]/g, '_');
  if (TYPE_MAP[u]) return { ...TYPE_MAP[u] };
  // Fuzzy matching — order matters (more specific first)
  if (u.includes('VACUUM') || u === 'VCB')                          return { ...TYPE_MAP.VACUUM_CB };
  if (u.includes('SF6'))                                             return { ...TYPE_MAP.SF6_CB };
  if (u === 'ACB' || u.includes('AIR_CIRCUIT'))                     return { ...TYPE_MAP.ACB };
  if (u.includes('MCCB'))                                           return { ...TYPE_MAP.MCCB };
  if (u.includes('RCCB'))                                           return { ...TYPE_MAP.RCCB };
  if (u === 'MCB' || u.includes('MINIATURE'))                       return { ...TYPE_MAP.MCB };
  if (u.includes('BREAKER') || u.includes('_CB') || u.endsWith('CB')) return { ...TYPE_MAP.CB };
  if (u.includes('AUTO_TRANSF') || u.includes('AUTOTRANSF'))        return { ...TYPE_MAP.AUTO_TRANSFORMER };
  if (u.includes('TRANSFORM') || u.includes('XFMR') || u.includes('MVA') || u.includes('KVA')) return { ...TYPE_MAP.POWER_TRANSFORMER };
  if (u.includes('DOUBLE_BUS'))                                     return { ...TYPE_MAP.DOUBLE_BUSBAR };
  if (u.includes('BUS_SECTION'))                                    return { ...TYPE_MAP.BUS_SECTION };
  if (u.includes('BUS'))                                            return { ...TYPE_MAP.BUS_BAR };
  if (u.includes('EARTH') || u.includes('GROUND_SW'))               return { ...TYPE_MAP.EARTH_SWITCH };
  if (u.includes('LIGHTNING') || u.includes('SURGE') || u.includes('ARRESTER')) return { ...TYPE_MAP.LIGHTNING_ARRESTER };
  if (u === 'LA')                                                    return { ...TYPE_MAP.LA };
  if (u.includes('ISOLAT') || u.includes('DISCONN') || u.includes('DISCONNECT')) return { ...TYPE_MAP.ISOLATOR };
  if (u.includes('RMU') || u.includes('RING_MAIN'))                 return { ...TYPE_MAP.RMU };
  if (u.includes('AUTO_RECLOS'))                                    return { ...TYPE_MAP.AUTO_RECLOSER };
  if (u.includes('LOAD_BREAK') || u === 'LBS')                      return { ...TYPE_MAP.LBS };
  if (u.includes('CONTACTOR'))                                      return { ...TYPE_MAP.CONTACTOR };
  if (u.includes('FUSE'))                                           return { ...TYPE_MAP.FUSE };
  if (u.includes('UNDERGROUND') || u.includes('UG_CABLE'))          return { ...TYPE_MAP.UNDERGROUND_CABLE };
  if (u.includes('OVERHEAD') || u.includes('OHL'))                  return { ...TYPE_MAP.OVERHEAD_LINE };
  if (u.includes('CABLE'))                                          return { ...TYPE_MAP.CABLE };
  if (u.includes('CURRENT_T') || u === 'CT')                        return { ...TYPE_MAP.CT };
  if (u.includes('POTENTIAL_T') || u.includes('VOLTAGE_T') || u === 'VT' || u === 'PT') return { ...TYPE_MAP.PT };
  if (u.includes('ENERGY_METER'))                                   return { ...TYPE_MAP.ENERGY_METER };
  if (u.includes('METER'))                                          return { ...TYPE_MAP.METER };
  if (u.includes('OVERCURRENT_R') || u.includes('OC_RELAY'))        return { ...TYPE_MAP.OVERCURRENT_RELAY };
  if (u.includes('EARTH_FAULT') || u.includes('EF_RELAY'))          return { ...TYPE_MAP.EARTH_FAULT_RELAY };
  if (u.includes('DIFF_RELAY') || u.includes('DIFFERENTIAL'))       return { ...TYPE_MAP.DIFFERENTIAL_RELAY };
  if (u.includes('RELAY'))                                          return { ...TYPE_MAP.RELAY };
  if (u.includes('CAPACITOR'))                                      return { ...TYPE_MAP.CAPACITOR_BANK };
  if (u.includes('REACTOR'))                                        return { ...TYPE_MAP.SHUNT_REACTOR };
  if (u.includes('MOTOR'))                                          return { ...TYPE_MAP.MOTOR };
  if (u.includes('GENERATOR') || u.includes('GEN'))                 return { ...TYPE_MAP.GENERATOR };
  if (u.includes('SOLAR_PANEL') || u.includes('PV_PANEL'))          return { ...TYPE_MAP.SOLAR_PANEL };
  if (u.includes('INVERTER'))                                       return { ...TYPE_MAP.SOLAR_INVERTER };
  if (u.includes('BATTERY') || u.includes('BESS'))                  return { ...TYPE_MAP.BATTERY };
  if (u.includes('VFD') || u.includes('DRIVE'))                     return { ...TYPE_MAP.VFD };
  if (u.includes('MCC'))                                            return { ...TYPE_MAP.MCC };
  if (u.includes('PANEL'))                                          return { ...TYPE_MAP.PANEL };
  if (u.includes('LOAD'))                                           return { ...TYPE_MAP.LOAD };
  if (u.includes('FEEDER') || u.includes('OUTGOING') || u.includes('INCOMING')) return { ...TYPE_MAP.FEEDER };
  if (u.includes('GROUND') || u.includes('EARTH'))                  return { ...TYPE_MAP.GROUND };
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

export async function generateSLDFromImage(imageBuffer: Buffer, mimeType: string, instructions = '') {
  const base64Image = imageBuffer.toString('base64');

  const prompt = `You are an expert electrical engineer analyzing a Single Line Diagram (SLD).
Extract EVERY electrical component with its exact label.

IMPORTANT: Use ONLY these exact type values (they map directly to library symbols):

SWITCHGEAR: CB | VacuumCB | SF6CB | ACB | MCCB | MCB | RCCB | Isolator | EarthSwitch | LoadBreakSwitch | AutoRecloser | RingMainUnit | GIS | Fuse | Contactor

TRANSFORMERS: Transformer | AutoTransformer | InstrumentTransformer | StepVoltageRegulator

BUSBARS & LINES: BusBar | DoubleBusBar | BusSection | Cable | OverheadLine | UndergroundCable

MEASUREMENT: CT | PT | Meter | EnergyMeter | PowerAnalyzer | Ammeter | Voltmeter | FrequencyMeter

PROTECTION: LightningArrester | Relay | OvercurrentRelay | EarthFaultRelay | DifferentialRelay | DistanceRelay | BuchholzRelay

LOADS & GENERATION: Feeder | GenericLoad | ResistiveLoad | InductiveLoad | Motor | Generator | SolarPanel | SolarInverter | WindTurbine | Battery

POWER ELECTRONICS: CapacitorBank | ShuntReactor | VFD | UPSDetail

MISC: Panel | MCC | Junction | Ground

TYPE SELECTION GUIDE:
- Vacuum CB / VCB → VacuumCB
- SF6 breaker → SF6CB
- Air circuit breaker → ACB
- General circuit breaker / OCB → CB
- Miniature circuit breaker → MCB or MCCB
- Isolating switch / disconnector → Isolator
- Lightning arrester / surge arrester / LA → LightningArrester
- Current transformer / CT → CT
- Potential/voltage transformer / PT / VT → PT
- Incoming/outgoing power line → OverheadLine or Cable
- Load point / consumer / feeder end → GenericLoad or Feeder
- Power transformer (with MVA rating) → Transformer
- Busbar / bus → BusBar

Return ONLY valid JSON (no markdown):
{
  "name": "substation or system name from diagram",
  "components": [
    {
      "id": "c1",
      "type": "VacuumCB",
      "label": "exact label from diagram e.g. VCB-1, 10 MVA 33/11kV, HV BUSBAR",
      "voltage": 33,
      "level": 0,
      "column": 0
    }
  ],
  "connections": [
    { "from": "c1", "to": "c2" }
  ]
}

Level (vertical position, 0=top):
- 0: incoming supply / grid source / overhead line
- 1: HV busbar (highest voltage)
- 2: power transformers
- 3: LV busbar (lower voltage)
- 4: feeder breakers / protection devices
- 5: loads / outgoing feeders / panels

Column: each parallel branch = separate column (0,1,2,3...)
Include ALL components, ALL busbars, ALL connections.
Return ONLY the JSON object.${instructions ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${instructions}\n\nApply these instructions on top of what you see in the diagram.` : ''}`;

  console.log(`[SLD] Calling Claude ${CLAUDE_MODEL}...`);
  const textContent = await claudeRequest(base64Image, mimeType, prompt);
  console.log('[SLD] Response length:', textContent.length);

  let jsonStr = textContent.trim();
  // Strip leading "json" word
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
      catch { throw new Error('Failed to parse Anthropic response: ' + textContent.substring(0, 300)); }
    } else {
      throw new Error('Failed to parse Anthropic response: ' + textContent.substring(0, 300));
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
