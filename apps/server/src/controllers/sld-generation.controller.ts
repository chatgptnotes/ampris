import { Request, Response } from 'express';
import { generateSLDFromImage } from '../services/sld-generation.service';
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

export const chatSLD = async (req: Request, res: Response) => {
  const { elements = [], connections = [], message, projectName = 'SLD' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const SYSTEM = `You are an expert electrical SLD (Single Line Diagram) editor.
You will receive the current SLD as JSON (elements + connections arrays) and a user instruction.
Apply the instruction and return the COMPLETE updated SLD JSON.

ELEMENT SCHEMA:
{
  "id": "unique string",
  "type": "BusBar|DoubleBusBar|BusSection|CB|VacuumCB|SF6CB|ACB|MCCB|MCB|RCCB|Isolator|EarthSwitch|LoadBreakSwitch|AutoRecloser|RingMainUnit|GIS|Fuse|Contactor|Transformer|AutoTransformer|CT|PT|Meter|EnergyMeter|LightningArrester|Relay|OvercurrentRelay|EarthFaultRelay|DifferentialRelay|Feeder|GenericLoad|ResistiveLoad|InductiveLoad|Motor|Generator|SolarPanel|SolarInverter|WindTurbine|Battery|CapacitorBank|ShuntReactor|VFD|Cable|OverheadLine|UndergroundCable|Panel|MCC|Junction|Ground",
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

    // Ensure every connection has a valid points array; generate straight-line points if missing
    const rawConns: any[] = parsed.connections || connections || [];
    const elementMap = new Map<string, any>(parsed.elements.map((e: any) => [e.id, e]));
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
      elements: parsed.elements,
      connections: safeConns,
      explanation: parsed.explanation || 'Changes applied',
    });

  } catch (err: any) {
    console.error('[SLD Chat] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI chat failed' });
  }
};
