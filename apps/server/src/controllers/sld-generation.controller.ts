// ⚠️ SKILL FILE REQUIRED — READ BEFORE MODIFYING THIS FILE
// ~/.openclaw/workspace/skills/gridvision-sld-ai/SKILL.md
//
// Key rules:
// - normalizeType() MUST be called on every AI-returned element (chatSLD + generateSLD)
// - claudeChatRequest(userMessage) — NOT claudeChatRequest(SYSTEM) [BUG-014]
// - Connections must have points[] with >= 2 entries before setConnections [BUG-013]

import { Request, Response } from 'express';
import { generateSLDFromImage, normalizeType } from '../services/sld-generation.service';
import { prisma } from '../config/database';
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

      const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';

      // Process in background
      generateSLDFromImage(imageBuffer, mimeType, instructions)
        .then(layout => {
          const totalEls = (layout.pages || []).reduce((sum: number, p: any) => sum + (p.elements?.length || 0), 0);
          console.log(`[SLD] Job ${jobId} done — ${(layout.pages || []).length} pages, ${totalEls} elements`);
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

// claudeChatRequestWithImage — sends text + optional image to Claude
function claudeChatRequestWithImage(prompt: string, imageBase64?: string | null, imageMime?: string): Promise<string> {
  const content: any[] = [];
  if (imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } });
  }
  content.push({ type: 'text', text: prompt });
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_CHAT_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      messages: [{ role: 'user', content }],
    });
    const req2 = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    }, (r) => {
      let data = '';
      r.on('data', (chunk) => { data += chunk; });
      r.on('end', () => {
        try { const json = JSON.parse(data); resolve(json.content?.[0]?.text || ''); }
        catch (e) { reject(new Error('Claude parse error: ' + data.slice(0, 200))); }
      });
    });
    req2.on('error', reject);
    req2.write(body);
    req2.end();
  });
}

function claudeChatRequest(prompt: string): Promise<string> {
  return claudeChatRequestWithImage(prompt, null);
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

// Detect if message is a "create from scratch" request
function isCreateRequest(message: string, elements: any[]): boolean {
  const m = message.toLowerCase();
  const createKeywords = ['create', 'generate', 'build', 'make', 'draw', 'design', 'new sld', 'new substation'];
  const hasCreateKeyword = createKeywords.some(k => m.includes(k));
  // Route through layout engine if canvas is empty OR message explicitly asks to create
  return hasCreateKeyword || elements.length === 0;
}

export const chatSLD = async (req: Request, res: Response) => {
  const { elements = [], connections = [], message, projectName = 'SLD', projectId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // ── Fetch original SLD image from project (for Claude vision context) ──────
  let sldImageBase64: string | null = null;
  let sldImageMime = 'image/jpeg';
  if (projectId) {
    try {
      const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { sldImage: true, sldImageMime: true } });
      if (proj?.sldImage) {
        sldImageBase64 = proj.sldImage;
        sldImageMime = proj.sldImageMime || 'image/jpeg';
        console.log(`[chatSLD] Loaded SLD image for project ${projectId} (${sldImageBase64.length} chars)`);
      }
    } catch (e) {
      console.warn('[chatSLD] Could not fetch project SLD image:', e);
    }
  }

  // ── Route "create" requests through the layout engine ─────────────────────
  if (isCreateRequest(message, elements)) {
    console.log('[chatSLD] Detected CREATE request — routing to layout engine');
    try {
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_AI_API_KEY || '';
      const CLAUDE_MODEL = 'claude-opus-4-6';

      const topoPrompt = `You are an expert electrical engineer designing a Single Line Diagram (SLD) topology for GridVision SCADA.

## YOUR ROLE
You are an expert electrical protection engineer building SLD topologies for GridVision SCADA.
You follow IEC/ANSI substation design standards strictly.
You NEVER start building the SLD until you fully understand the system, especially interlocks.

---

## STEP 1 — DETECT COMPLEXITY FLAGS
Before deciding whether to ask questions, check if the description contains:
- Generator / DG / genset / diesel / solar inverter / wind / BESS → 🚨 GENERATOR FLAG
- Multiple incomers / dual supply / incomer-1 / incomer-2 → 🚨 DUAL INCOMER FLAG
- Bus-tie / bus coupler / bus section / sectionaliser → 🚨 BUS-TIE FLAG
- ATS / auto transfer / changeover → 🚨 ATS FLAG

---

## STEP 2 — MANDATORY INTERLOCK QUESTIONS (ask ALL at once in one message)

### 🚨 If GENERATOR FLAG is set — ASK THESE before generating:
1. Can the generator run IN PARALLEL with the grid incomer, or is it NON-PARALLEL (only one source at a time)?
2. Is the transfer MANUAL (operator switches) or AUTO (ATS / automatic transfer switch)?
3. If parallel: is there a SYNC CHECK RELAY on the generator VCB, or manual synchronisation?
4. On grid failure: does the generator AUTO-START and AUTO-CLOSE its VCB, or manual?
5. Is there ANTI-ISLANDING protection (generator trips if grid disconnects)?
6. On grid restoration: does generator AUTO-TRIP and grid AUTO-RECLOSE, or manual?
7. Is there a BUS-TIE / BUS-COUPLER breaker between grid bus and generator bus?

### 🚨 If DUAL INCOMER FLAG is set — ASK:
1. Is the bus-tie normally OPEN or normally CLOSED?
2. On loss of Incomer-1, does the bus-tie AUTO-CLOSE (auto-changeover), or manual?
3. Can both incomers feed the bus simultaneously, or interlock prevents this?

### 🚨 If ATS FLAG is set — ASK:
1. What is the transfer time (seconds)?
2. Is it a 3-position changeover (Grid/Off/Gen) or a 4-pole MCCB pair?
3. Is there a time delay before retransfer to grid?

---

## CLARIFYING QUESTION FORMAT
If ANY flag is set and you do NOT have the answers → output ONLY:
{
  "clarifying_question": "Ask ALL required questions here in a numbered list. Be specific and technical. Do not guess."
}

Do NOT generate the topology until you have answers to ALL required questions.

---

## STEP 3 — INTERLOCK RULES TO ENCODE IN TOPOLOGY

Once you have answers, encode interlock rules in element labels:
- Non-parallel generator VCB label: "GEN-VCB [INTLK: INC-VCB]"
- Incomer VCB label: "INC-VCB [INTLK: GEN-VCB]" 
- Bus-tie label: "BUS-TIE [NO]" or "BUS-TIE [NC]"
- ATS label: "ATS [5s transfer]"
- Earth switch label: "ES [INTLK: VCB]"
Add interlock info to element properties: { "interlock": "non-parallel with INC-VCB", "interlock_partner": "inc_vcb_id" }

---

## TOPOLOGY FORMAT (only output when you fully understand the system)
{
  "name": "descriptive name",
  "topologyType": "single-busbar" | "double-busbar" | "ring",
  "busbar": { "id": "bus1", "type": "BusBar", "label": "11kV Main Busbar", "voltage": 11 },
  "incomers": [
    { "id": "inc1", "label": "Grid Incomer",
      "elements": [
        { "id": "la1",  "type": "LightningArrester", "label": "LA" },
        { "id": "iso1", "type": "Isolator",           "label": "89-I" },
        { "id": "vcb1", "type": "VacuumCB",           "label": "INC-VCB [INTLK: GEN-VCB]",
          "properties": { "interlock": "non-parallel with GEN-VCB", "interlock_partner": "vcb_gen1" } },
        { "id": "ct1",  "type": "CT", "label": "CT-I" }
      ]
    },
    { "id": "gen1", "label": "Generator",
      "elements": [
        { "id": "g1",    "type": "Generator",  "label": "1000kVA DG" },
        { "id": "vcb_g", "type": "VacuumCB",   "label": "GEN-VCB [INTLK: INC-VCB] [SYNC CHECK]",
          "properties": { "interlock": "non-parallel with INC-VCB", "interlock_partner": "vcb1", "syncCheck": true } },
        { "id": "ct_g",  "type": "CT", "label": "CT-G" }
      ]
    }
  ],
  "feeders": [ ... ],
  "transformers": []
}

## TRANSFORMER PLACEMENT
- "transformer as incomer" / HV/LV substation → PUT inside incomer chain: [LA → Isolator → Transformer → VCB → CT]
- 11/11kV = ONE Transformer (isolation), NOT two — put in incomer chain
- 33/11kV or 11/0.4kV = step-down = put in incomer chain as the source

## TYPE NAMES (exact PascalCase)
Switchgear: CB | VacuumCB | SF6CB | ACB | MCCB | MCB | Fuse | Isolator | EarthSwitch | LoadBreakSwitch | AutoRecloser
Transformers: Transformer | AutoTransformer | StepVoltageRegulator
Busbars: BusBar | DoubleBusBar | BusSection
Measurement: CT | PT | EnergyMeter | Meter
Protection: LightningArrester | OvercurrentRelay | EarthFaultRelay | DifferentialRelay | BuchholzRelay
Loads: Feeder | GenericLoad | Motor | SolarInverter | CapacitorBank | Generator
TYPE GUIDE: VCB → VacuumCB | bus → BusBar | VT/PT → PT | LA → LightningArrester | load → GenericLoad | genset/DG → Generator

## INCOMER ORDER (top→busbar): [LA, Isolator, VacuumCB, CT] OR [LA, Isolator, Transformer, VacuumCB, CT]
## FEEDER ORDER (busbar→load): [VacuumCB, CT, PT, GenericLoad]

## STEP 4 — ALWAYS ASK ABOUT DATA SOURCE (ask along with other questions or after topology is clear)
Before generating the final topology, ask:
"What is the real-time data source for this SLD? Options:
  (a) Modbus TCP/RTU — specify IP/port and slave ID
  (b) DNP3 — specify IP and station address
  (c) IEC 61850 — specify IED name and IP
  (d) OPC-UA — specify server URL
  (e) MQTT — specify broker and topic prefix
  (f) Manual / no real-time data (SLD diagram only, no live values)"

Encode the answer in the topology JSON:
{ "dataSource": { "protocol": "modbus-tcp", "host": "192.168.1.100", "port": 502, "slaveId": 1 } }
OR
{ "dataSource": { "protocol": "none" } }

If user says "no data" or "diagram only" → set dataSource.protocol = "none" and do NOT create tag bindings.
If user provides a real device → include device details so tags can be mapped to registers/addresses.

## RULES
- Each feeder = SEPARATE object in feeders array
- ALWAYS include busbar
- Return ONLY valid JSON — no markdown, no text outside JSON`;

      const body = JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 4096, temperature: 0.1,
        system: topoPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const https = require('https');
      const raw: string = await new Promise((resolve, reject) => {
        const r = https.request({
          hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        }, (res2: any) => { let d = ''; res2.on('data', (c: any) => d += c); res2.on('end', () => { try { const p = JSON.parse(d); resolve(p.content?.[0]?.text || ''); } catch { reject(new Error('Parse error')); } }); });
        r.on('error', reject); r.write(body); r.end();
      });

      let jsonStr = raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
      const jm = jsonStr.match(/\{[\s\S]*\}/); if (jm) jsonStr = jm[0];
      let topo: any;
      try { topo = JSON.parse(jsonStr); } catch { const lb = jsonStr.lastIndexOf('}'); try { topo = JSON.parse(jsonStr.substring(0,lb+1)); } catch { throw new Error('Invalid topology JSON'); } }

      // Claude wants clarification before generating
      if (topo.clarifying_question) {
        return res.json({
          elements: [], connections: [],
          clarifying_question: topo.clarifying_question,
          explanation: `❓ ${topo.clarifying_question}`,
        });
      }

      topo.incomers     = topo.incomers     || [];
      topo.feeders      = topo.feeders      || [];
      topo.transformers = topo.transformers || [];
      if (!topo.busbar) topo.busbar = { id:'bus1', type:'BusBar', label:'Main Busbar', voltage:11 };

      const { layoutSubstation } = await import('../services/sld-layout.service');
      const { elements: newEls, connections: newConns } = layoutSubstation(topo);

      // Normalize all types through the TYPE_MAP
      const newElements = newEls.map((el: any) => {
        const norm = normalizeType(el.type || '');
        // Preserve BusBar relX1/relY1/relX2/relY2 — these are required for full-width line rendering
        return {
          ...el,
          type: norm.type,
          width: (el.width && el.width > 0) ? el.width : (norm.w || 60),
          height: (el.height && el.height > 0) ? el.height : (norm.h || 60),
        };
      });

      return res.json({
        elements: newElements,
        connections: newConns.filter((c: any) => Array.isArray(c.points) && c.points.length >= 2),
        explanation: `Created ${topo.name || 'SLD'} using layout engine: ${topo.incomers.length} incomer(s), ${topo.feeders.length} feeder(s), ${topo.transformers.length} transformer(s). All elements perfectly aligned.`,
      });
    } catch (err: any) {
      console.error('[chatSLD create]', err.message);
      // Fall through to regular edit path on error
    }
  }

  try {
    const SYSTEM = `You are an expert electrical SLD (Single Line Diagram) editor for MSEDCL Smart Distribution Substations.
You will receive the current SLD as a SLIM element list and a user instruction.
⚠️ DELTA RESPONSE ONLY — do NOT return the full SLD. Only return what changed.
This allows handling SLDs of ANY size (100s of elements) without token limits.

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
⚠️ DELTA FORMAT — only return what changed:
{
  "delta": {
    "added":    [ /* new full elements — include all fields */ ],
    "modified": [ /* changed elements — full element with id */ ],
    "removed":  [ "id1", "id2" ]
  },
  "connections_delta": {
    "added":   [ /* new connections — full conn with points */ ],
    "removed": [ "connId1" ]
  },
  "explanation": "one sentence describing the change"
}
Omit or use [] for unchanged sections. Never return full elements/connections arrays.`;

    // Strip fat properties before sending to Claude — reduces payload by ~60%
    // Claude doesn't need tagBindings, zIndex, rotation, showLabel for editing
    const slimElements = elements.map((el: any) => ({
      id: el.id,
      type: el.type,
      x: el.x, y: el.y,
      width: el.width, height: el.height,
      label: el.properties?.label || el.label || el.type,
      // BusBar line rendering coords — Claude must preserve these
      ...(el.type === 'BusBar' || el.type === 'DoubleBusBar' ? {
        relX1: el.properties?.relX1,
        relY1: el.properties?.relY1,
        relX2: el.properties?.relX2,
        relY2: el.properties?.relY2,
        busWidth: el.properties?.busWidth,
        color: el.properties?.color,
      } : {}),
    }));
    const slimConns = connections.map((c: any) => ({
      id: c.id, fromId: c.fromId, toId: c.toId, points: c.points,
    }));
    const currentSLD = JSON.stringify({ elements: slimElements, connections: slimConns });
    const imageContextNote = sldImageBase64
      ? `\nThe original SLD diagram image is attached. Use it to understand the full substation layout, any labels, and connections not yet reflected in the current elements JSON.\n`
      : '';
    const userMessage = `${imageContextNote}Current SLD (${elements.length} elements, ${connections.length} connections):\n${currentSLD}\n\nUser instruction: "${message}"\n\nReturn updated SLD JSON:`;

    const raw = (await claudeChatRequestWithImage(userMessage, sldImageBase64, sldImageMime)).trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI returned invalid JSON');
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // Try trimming to last valid closing brace
        const lb = match[0].lastIndexOf('}');
        parsed = JSON.parse(match[0].substring(0, lb + 1) + ',"explanation":"partial response recovered"}');
      }
    }

    // Helper: normalise a single element
    function normaliseEl(el: any) {
      const norm = normalizeType(el.type || '');
      const busDefaults: Record<string, { w: number; h: number }> = {
        BusBar: { w: 600, h: 20 }, DoubleBusBar: { w: 600, h: 30 }, BusSection: { w: 50, h: 25 },
      };
      const def = busDefaults[norm.type];
      return {
        ...el,
        type: norm.type,
        width:  (el.width  && el.width  > 0) ? el.width  : (def?.w || norm.w || 60),
        height: (el.height && el.height > 0) ? el.height : (def?.h || norm.h || 60),
        rotation: el.rotation ?? 0,
        zIndex:   el.zIndex   ?? 1,
        properties: {
          label: el.properties?.label || el.label || norm.type,
          showLabel: el.properties?.showLabel !== false,
          tagBindings: el.properties?.tagBindings || {},
          ...(el.properties || {}),
        },
      };
    }

    // Helper: auto-generate connection points if missing
    function fixConn(c: any, elMap: Map<string, any>) {
      if (Array.isArray(c.points) && c.points.length >= 2) return c;
      const from = elMap.get(c.fromId), to = elMap.get(c.toId);
      if (!from || !to) return null;
      const fx = Math.round(from.x + from.width  / 2);
      const fy = Math.round(from.y + from.height);
      const tx = Math.round(to.x   + to.width    / 2);
      const ty = Math.round(to.y);
      const midY = Math.round((fy + ty) / 2);
      const pts = fx === tx
        ? [{ x: fx, y: fy }, { x: tx, y: ty }]
        : [{ x: fx, y: fy }, { x: fx, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }];
      return { ...c, points: pts };
    }

    let finalElements: any[];
    let finalConns: any[];

    // ── DELTA path (preferred — handles any SLD size) ──────────────────────
    if (parsed.delta) {
      const d     = parsed.delta;
      const cd    = parsed.connections_delta || {};
      const elMap = new Map<string, any>(elements.map((e: any) => [e.id, { ...e }]));
      const cnMap = new Map<string, any>(connections.map((c: any) => [c.id, { ...c }]));

      // Apply element delta
      (d.removed  || []).forEach((id: string) => elMap.delete(id));
      (d.modified || []).forEach((el: any)   => elMap.set(el.id, normaliseEl(el)));
      (d.added    || []).forEach((el: any)   => elMap.set(el.id, normaliseEl(el)));

      // Apply connection delta
      (cd.removed || []).forEach((id: string) => cnMap.delete(id));
      (cd.added   || []).forEach((c: any)     => cnMap.set(c.id, c));

      finalElements = Array.from(elMap.values());
      const newElMap = new Map<string, any>(finalElements.map(e => [e.id, e]));
      finalConns = Array.from(cnMap.values())
        .map((c: any) => fixConn(c, newElMap))
        .filter(Boolean)
        .filter((c: any) => Array.isArray(c.points) && c.points.length >= 2);

    // ── Fallback: full response (legacy / small SLDs) ──────────────────────
    } else if (Array.isArray(parsed.elements)) {
      finalElements = parsed.elements.map(normaliseEl);
      const elMap   = new Map<string, any>(finalElements.map((e: any) => [e.id, e]));
      finalConns    = (parsed.connections || connections || [])
        .map((c: any) => fixConn(c, elMap))
        .filter(Boolean)
        .filter((c: any) => Array.isArray(c.points) && c.points.length >= 2);
    } else {
      throw new Error('AI returned neither delta nor elements array');
    }

    return res.json({
      elements:    finalElements,
      connections: finalConns,
      explanation: parsed.explanation || 'Changes applied',
    });

  } catch (err: any) {
    console.error('[SLD Chat] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI chat failed' });
  }
};

// ── POST /api/sld/analyze — read uploaded image, describe understanding ──────
const analyzeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const analyzeSLDImage = [
  (req: Request, res: Response, next: any) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) analyzeUpload.single('file')(req, res, next);
    else next();
  },
  async (req: Request, res: Response) => {
    try {
      let imageBase64: string;
      let mimeType = 'image/jpeg';

      if (req.file) {
        imageBase64 = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype;
      } else if (req.body?.image) {
        imageBase64 = req.body.image;
        mimeType = req.body.mimeType || 'image/jpeg';
      } else {
        return res.status(400).json({ error: 'No image provided' });
      }

      const prompt = `You are an expert electrical engineer analyzing a Single Line Diagram (SLD) or substation drawing.

Carefully study this image and provide a friendly, structured summary of what you see. Be specific — read actual labels, names, and numbers from the diagram.

Respond in this format:

**What I can see in your diagram:**

1. **Substation Name:** [exact name from diagram, or "Not labeled"]
2. **Voltage Level:** [e.g. 11kV, 33/11kV, 132/33/11kV]
3. **Incomer / Source:** [what feeds the busbar — OHL, cable, transformer, etc. with labels if visible]
4. **Busbar:** [type and label, e.g. "11kV Main Busbar"]
5. **Number of Outgoing Feeders:** [count them — be precise]
6. **Feeder Names:** [list all feeder names/labels visible, e.g. "F1 Sahuli Town, F2 Railway Colony..."]
7. **Protection Equipment:** [CTs, PTs, relays, meters visible]
8. **Special Elements:** [any transformers, capacitor banks, DG sets, metering cubicles, etc.]
9. **Layout Notes:** [multi-page? landscape/portrait? any sections to skip?]

After the summary, ask:
**"Is this correct? Please tell me:**
- How many pages do you want the SLD split across?
- How many feeders per page?
- Anything to skip (e.g. 33/11kV section, metering cubicle)?
- Any specific labels or naming you want?
- Any elements to add or remove?"`;

      const analysis = await claudeChatRequestWithImage(prompt, imageBase64, mimeType);
      return res.json({ analysis, imageBase64, mimeType });
    } catch (err: any) {
      console.error('[SLD Analyze]', err.message);
      return res.status(500).json({ error: err.message || 'Analysis failed' });
    }
  }
];

// ── POST /api/sld/pre-chat — conversational refinement before generation ─────
export const preGenerationChat = async (req: Request, res: Response) => {
  try {
    const { message, history = [], imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Build conversation history for Claude
    const messages: any[] = [];

    // Always include the image in the first user turn
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: 'This is the SLD diagram we are discussing.' }
        ]
      });
      messages.push({ role: 'assistant', content: 'I can see the SLD diagram. How can I help you refine what you want generated?' });
    }

    // Add conversation history
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const systemPrompt = `You are an expert electrical engineer helping a user define exactly what SLD they want generated from their uploaded diagram.

Your goal: understand the user's requirements and when you have enough information, output a CONFIRMED SPEC in this exact format at the end of your reply:

---CONFIRMED SPEC---
{
  "ready": true,
  "instructions": "14 feeders per page. Start after metering cubicle, ignore 33/11kV section. 2 pages total.",
  "summary": "2-page 11kV SLD with 14 feeders per page, starting from the 11kV busbar after the metering cubicle"
}
---END SPEC---

Only output the CONFIRMED SPEC when the user has confirmed they are happy with the plan.
If you still need clarification, ask specific questions. Keep responses concise and friendly.
Focus on: pages, feeders per page, scope (what to include/exclude), naming, voltage level.`;

    const body = JSON.stringify({
      model: CLAUDE_CHAT_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const reply = await new Promise<string>((resolve, reject) => {
      const r2 = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      }, (r) => {
        let d = ''; r.on('data', (c) => d += c);
        r.on('end', () => {
          try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch { reject(new Error('Parse error')); }
        });
      });
      r2.on('error', reject); r2.write(body); r2.end();
    });

    // Check if AI has confirmed the spec
    const specMatch = reply.match(/---CONFIRMED SPEC---\s*([\s\S]*?)\s*---END SPEC---/);
    let confirmedSpec = null;
    if (specMatch) {
      try { confirmedSpec = JSON.parse(specMatch[1]); } catch {}
    }

    return res.json({ reply, confirmedSpec });
  } catch (err: any) {
    console.error('[SLD Pre-chat]', err.message);
    return res.status(500).json({ error: err.message || 'Chat failed' });
  }
};
