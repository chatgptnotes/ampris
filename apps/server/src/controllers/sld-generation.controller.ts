// ⚠️ SKILL FILE REQUIRED — READ BEFORE MODIFYING THIS FILE
// ~/.openclaw/workspace/skills/gridvision-sld-ai/SKILL.md
//
// Key rules:
// - normalizeType() MUST be called on every AI-returned element (chatSLD + generateSLD)
// - claudeChatRequest(userMessage) — NOT claudeChatRequest(SYSTEM) [BUG-014]
// - Connections must have points[] with >= 2 entries before setConnections [BUG-013]

import { Request, Response } from 'express';
import { generateSLDFromImage, normalizeType } from '../services/sld-generation.service';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// In-memory job store
const jobs = new Map<string, { status: 'pending'|'done'|'error'; layout?: any; error?: string }>();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// POST /api/sld/queue — accepts base64 JSON or multipart, returns jobId immediately
export const queueSLDGeneration = [
  (req: Request, res: Response, next: any) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      upload.single('file')(req, res, next);
    } else {
      next();
    }
  },
  async (req: Request, res: Response) => {
    try {
      let imageBuffer: Buffer;
      let mimeType = 'image/jpeg';

      if (req.file) {
        // Multipart upload
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
        console.log(`[SLD] File received: ${req.file.originalname} | size: ${req.file.size} bytes | type: ${mimeType}`);
      } else if (req.body?.image) {
        // Base64 JSON
        imageBuffer = Buffer.from(req.body.image, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
        console.log(`[SLD] Base64 received: ${imageBuffer.length} bytes | type: ${mimeType}`);
      } else {
        return res.status(400).json({ success: false, error: 'No image provided' });
      }

      const jobId = uuid();
      jobs.set(jobId, { status: 'pending' });

      // Process in background
      generateSLDFromImage(imageBuffer, mimeType)
        .then(layout => {
          console.log(`[SLD] Job ${jobId} done — elements: ${layout.elements.length}`);
          jobs.set(jobId, { status: 'done', layout });
          // Clean up after 10 minutes
          setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
        })
        .catch(err => {
          console.error(`[SLD] Job ${jobId} failed:`, err.message);
          jobs.set(jobId, { status: 'error', error: err.message });
          setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
        });

      return res.json({ success: true, jobId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
];

// GET /api/sld/status/:jobId
export const getSLDStatus = (req: Request, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  return res.json({ success: true, ...job });
};

// Legacy POST /api/sld/generate (kept for compatibility)
export const generateSLD = [
  (req: Request, res: Response, next: any) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      upload.single('file')(req, res, next);
    } else {
      next();
    }
  },
  async (req: Request, res: Response) => {
    try {
      let imageBuffer: Buffer;
      let mimeType = 'image/jpeg';
      if (req.file) {
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
      } else if (req.body?.image) {
        imageBuffer = Buffer.from(req.body.image, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
      } else {
        return res.status(400).json({ success: false, error: 'No image provided' });
      }
      const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
      const layout = await generateSLDFromImage(imageBuffer, mimeType, instructions);
      return res.json({ success: true, layout });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sld/chat  — AI chat to modify existing SLD elements
// Body: { elements, connections, message, projectName? }
// Returns: { elements, connections, explanation }
// ─────────────────────────────────────────────────────────────────────────────
import * as https from 'https';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_CHAT_MODEL = 'claude-opus-4-6';

function claudeChatRequest(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_CHAT_MODEL,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });
    const req2 = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (r) => {
      let data = '';
      r.on('data', (chunk) => { data += chunk; });
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.content?.[0]?.text || '';
          resolve(text);
        } catch (e) { reject(new Error('Claude parse error: ' + data.slice(0, 200))); }
      });
    });
    req2.on('error', reject);
    req2.write(body);
    req2.end();
  });
}

// ── Text-to-SLD: generate from description (no image upload) ───────────────
export const generateSLDFromText = async (req: Request, res: Response) => {
  const { description, instructions } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });

  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_AI_API_KEY || '';
    const CLAUDE_MODEL = 'claude-opus-4-6';

    const systemPrompt = `You are an expert electrical engineer designing a Single Line Diagram (SLD) topology.
Given a description, output the substation topology as JSON.
DO NOT output any coordinates, x, y, width, height — the layout engine handles all positioning.

⚠️ TYPE NAMES — EXACT PascalCase only:
Switchgear: CB | VacuumCB | SF6CB | ACB | MCCB | Fuse | Isolator | EarthSwitch | LoadBreakSwitch | AutoRecloser | RingMainUnit | GIS
Transformers: Transformer | AutoTransformer | StepVoltageRegulator
Busbars: BusBar | DoubleBusBar
Lines: OverheadLine | Cable
Measurement: CT | PT | EnergyMeter | Meter
Protection: LightningArrester | OvercurrentRelay | EarthFaultRelay | DifferentialRelay | BuchholzRelay
Loads: Feeder | GenericLoad | Motor | Generator | SolarInverter | CapacitorBank

TYPE GUIDE:
VCB/vacuum breaker → VacuumCB | general breaker → CB | bus → BusBar
CT → CT | PT/VT → PT | LA/arrester → LightningArrester
isolator/disconnector → Isolator | earth switch → EarthSwitch
power transformer → Transformer | load → GenericLoad | outgoing feeder → Feeder

Output format:
{
  "name": "descriptive name",
  "topologyType": "single-busbar",
  "busbar": { "id": "bus1", "type": "BusBar", "label": "11kV Main Busbar", "voltage": 11 },
  "incomers": [
    { "id": "inc1", "label": "Incomer",
      "elements": [
        { "id": "la1",  "type": "LightningArrester", "label": "LA"       },
        { "id": "iso1", "type": "Isolator",           "label": "89-I"     },
        { "id": "vcb1", "type": "VacuumCB",           "label": "VCB-I"   },
        { "id": "ct1",  "type": "CT",                 "label": "CT-I"    }
      ]
    }
  ],
  "feeders": [
    { "id": "f1", "label": "Feeder-1",
      "elements": [
        { "id": "vcb_f1", "type": "VacuumCB",   "label": "VCB-F1"   },
        { "id": "ct_f1",  "type": "CT",          "label": "CT-F1"    },
        { "id": "ld_f1",  "type": "GenericLoad", "label": "Feeder-1" }
      ]
    }
  ],
  "transformers": []
}

RULES:
- Each feeder = SEPARATE object in feeders array (NEVER merge feeders)
- incomers = chains above busbar, ordered top→bottom (source first)
- feeders = chains below busbar, ordered top→bottom (busbar side first)
- transformers = separate from chains
- ALWAYS include Transformer if description mentions voltage ratio (e.g. 33/11kV, 11/0.4kV)
- ALWAYS include busbar
- Standard incomer chain: LightningArrester → Isolator → VacuumCB → CT (top to bottom)
- Standard feeder chain: VacuumCB → CT → GenericLoad (top to bottom)
${instructions ? `\nExtra instructions: ${instructions}` : ''}`;

    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: description }],
    });

    const https = require('https');
    const raw: string = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      }, (r: any) => { let d = ''; r.on('data', (c: any) => d += c); r.on('end', () => { try { const p = JSON.parse(d); resolve(p.content?.[0]?.text || ''); } catch { reject(new Error('Parse error')); } }); });
      req2.on('error', reject); req2.write(body); req2.end();
    });

    let jsonStr = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const jMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jMatch) jsonStr = jMatch[0];

    let topo: any;
    try { topo = JSON.parse(jsonStr); }
    catch { const lb = jsonStr.lastIndexOf('}'); try { topo = JSON.parse(jsonStr.substring(0, lb + 1)); } catch { throw new Error('Invalid JSON from AI: ' + raw.substring(0, 200)); } }

    topo.incomers     = topo.incomers     || [];
    topo.feeders      = topo.feeders      || [];
    topo.transformers = topo.transformers || [];
    if (!topo.busbar) topo.busbar = { id: 'bus1', type: 'BusBar', label: 'Main Busbar', voltage: 11 };

    const { layoutSubstation } = await import('../services/sld-layout.service');
    const { elements, connections } = layoutSubstation(topo);
    const { v4: uuid } = require('uuid');

    return res.json({
      id: uuid(), substationId: uuid(),
      name: topo.name || 'AI Generated SLD',
      width: 1600, height: 900,
      elements, connections,
    });
  } catch (err: any) {
    console.error('[SLD-TEXT]', err.message);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
};

export const chatSLD = async (req: Request, res: Response) => {
  const { elements = [], connections = [], message, projectName = 'SLD' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const SYSTEM = `You are an expert electrical SLD (Single Line Diagram) editor for MSEDCL Smart Distribution Substations.
You will receive the current SLD as JSON (elements + connections arrays) and a user instruction.
Apply the instruction and return the COMPLETE updated SLD JSON.

⚠️ CRITICAL RULE — EXACT TYPE NAMES:
You MUST use ONLY these exact PascalCase type strings. Any other value will render as a blank box.

SWITCHGEAR: CB | VacuumCB | SF6CB | ACB | MCCB | MCB | RCCB | Fuse | Contactor
DISCONNECTS: Isolator | EarthSwitch | LoadBreakSwitch | AutoRecloser | Sectionalizer
HV EQUIPMENT: RingMainUnit | GIS
TRANSFORMERS: Transformer | AutoTransformer | ZigZagTransformer | InstrumentTransformer | StepVoltageRegulator
BUSBARS: BusBar | DoubleBusBar | BusSection | BusTie
LINES/CABLES: Cable | OverheadLine | UndergroundCable
MEASUREMENT: CT | PT | Meter | EnergyMeter | PowerAnalyzer | Ammeter | Voltmeter | Wattmeter
PROTECTION: LightningArrester | Relay | OvercurrentRelay | EarthFaultRelay | DifferentialRelay | DistanceRelay | DirectionalRelay | BuchholzRelay | LockoutRelay
LOADS: Feeder | GenericLoad | ResistiveLoad | InductiveLoad | LightingLoad | HeatingLoad | FanLoad
MACHINES: Motor | AsyncMotor | SyncMotor | Generator | SyncGenerator | VFD | SoftStarter
POWER ELECTRONICS: CapacitorBank | ShuntReactor | SeriesReactor | Battery | SolarPanel | SolarInverter | WindTurbine | BESS | Inverter | Rectifier | UPSDetail
INFRA: Junction | Ground | Terminal | Panel | MCC | PLC | HMI | Enclosure
MISC: Valve | Pump | Compressor | AHU | Chiller | Tank

TYPE SELECTION GUIDE:
- vacuum breaker / VCB → VacuumCB
- SF6 breaker → SF6CB
- air circuit breaker → ACB
- general circuit breaker → CB
- bus / busbar → BusBar
- 11kV/33kV/66kV/132kV bus → BusBar (width 300-600, height 10)
- load point / distribution feeder → GenericLoad
- outgoing feeder → Feeder
- incoming HV line → OverheadLine or Cable
- current transformer → CT
- potential/voltage transformer → PT
- lightning arrester → LightningArrester
- earth switch → EarthSwitch
- isolator / disconnector → Isolator

ELEMENT SCHEMA:
{
  "id": "unique string",
  "type": "<exact type from list above — NEVER lowercase, NEVER snake_case>",
  "x": number (0-1600),
  "y": number (0-900),
  "width": number,
  "height": number,
  "rotation": 0,
  "zIndex": 1,
  "properties": {
    "label": "display text",
    "showLabel": true,
    "tagBindings": {},
    "voltage"?: "11kV",
    "rating"?: "1250A",
    "color"?: "#1d4ed8"
  }
}

CONNECTION SCHEMA:
{ "id": "string", "fromId": "elementId", "toId": "elementId", "points": [{"x":n,"y":n},{"x":n,"y":n}], "color": "#000", "thickness": 2 }

RULES:
- Keep all existing elements unless explicitly told to remove
- New element IDs: use "el_<random6chars>"
- New connection IDs: use "conn_<random6chars>"
- Maintain vertical hierarchy: busbars horizontal, feeders hang downward
- Keep elements within canvas bounds: x 0-1560, y 0-860
- For "add feeder X": add a VacuumCB (or appropriate CB type) below the busbar + a GenericLoad below it + connections
- ALWAYS use the exact type strings listed above — never use generic names like "circuit_breaker", "busbar", "load", "cable"
- BusBar elements MUST have width >= 400 and height = 20 exactly — NEVER width 0 or height 10
- ALWAYS include a Transformer element for any substation with stepping voltage (e.g. 33/11kV, 11/0.4kV)
- DoubleBusBar: width >= 400, height = 30
- VCB/vacuum breaker → VacuumCB | SF6 breaker → SF6CB | General CB → CB | Bus → BusBar | Load point → GenericLoad | Incoming/outgoing line → OverheadLine or Cable
- For "rename X to Y": update the label property
- For "remove X": remove from elements and any connections referencing it
- For "change voltage": update voltage property on matching elements
- For "move X left/right/up/down": adjust x/y by ~80px
- Always return ONLY valid JSON, no markdown, no explanation text outside JSON

Return format (STRICT JSON only):
{
  "elements": [...complete updated array...],
  "connections": [...complete updated array...],
  "explanation": "one sentence: what was done"
}`;

    const currentSLD = JSON.stringify({ elements, connections }, null, 2);
    const userMessage = `Current SLD (${elements.length} elements, ${connections.length} connections):\n${currentSLD}\n\nUser instruction: "${message}"\n\nReturn updated SLD JSON:`;

    const raw = (await claudeChatRequest(userMessage)).trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from response
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI returned invalid JSON');
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed.elements)) throw new Error('Missing elements array in AI response');

    // Normalize element types — AI sometimes returns lowercase/snake_case; convert to exact SYMBOL_MAP keys
    const normalizedElements = parsed.elements.map((el: any) => {
      const norm = normalizeType(el.type || '');
      // BusBar special defaults — wide & flat
      const busDefaults: Record<string, { w: number; h: number }> = {
        BusBar:       { w: 500, h: 20 },
        DoubleBusBar: { w: 500, h: 30 },
        BusSection:   { w: 40,  h: 25 },
      };
      const def = busDefaults[norm.type];
      return {
        ...el,
        type: norm.type,
        width:  (el.width  && el.width  > 0) ? el.width  : (def?.w || norm.w || 60),
        height: (el.height && el.height > 0) ? el.height : (def?.h || norm.h || 60),
        rotation: el.rotation ?? 0,
        zIndex: el.zIndex ?? 1,
        properties: {
          label: el.properties?.label || el.label || '',
          showLabel: el.properties?.showLabel !== false,
          tagBindings: el.properties?.tagBindings || {},
          ...(el.properties || {}),
        },
      };
    });

    // Ensure every connection has a valid points array; generate straight-line points if missing
    const rawConns: any[] = parsed.connections || connections || [];
    const elementMap = new Map<string, any>(normalizedElements.map((e: any) => [e.id, e]));
    const safeConns = rawConns.map((c: any) => {
      if (Array.isArray(c.points) && c.points.length >= 2) return c;
      // Generate points from fromId/toId element positions
      const from = elementMap.get(c.fromId);
      const to   = elementMap.get(c.toId);
      if (from && to) {
        const fx = Math.round((from.x || 0) + (from.width || 60) / 2);
        const fy = Math.round((from.y || 0) + (from.height || 60));
        const tx = Math.round((to.x || 0)   + (to.width   || 60) / 2);
        const ty = Math.round(to.y || 0);
        const midY = Math.round((fy + ty) / 2);
        const pts = fx === tx
          ? [{ x: fx, y: fy }, { x: tx, y: ty }]
          : [{ x: fx, y: fy }, { x: fx, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }];
        return { ...c, points: pts };
      }
      return null; // drop connection if we can't compute points
    }).filter(Boolean);

    return res.json({
      elements: normalizedElements,
      connections: safeConns,
      explanation: parsed.explanation || 'Changes applied',
    });

  } catch (err: any) {
    console.error('[SLD Chat] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI chat failed' });
  }
};
