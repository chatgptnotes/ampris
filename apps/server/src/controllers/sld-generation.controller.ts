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
      const layout = await generateSLDFromImage(imageBuffer, mimeType);
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
import Anthropic from '@anthropic-ai/sdk';

export const chatSLD = async (req: Request, res: Response) => {
  const { elements = [], connections = [], message, projectName = 'SLD' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    const client = new Anthropic({ apiKey });

    const SYSTEM = `You are an expert electrical SLD (Single Line Diagram) editor.
You will receive the current SLD as JSON (elements + connections arrays) and a user instruction.
Apply the instruction and return the COMPLETE updated SLD JSON.

ELEMENT SCHEMA:
{
  "id": "unique string",
  "type": "busbar|circuit_breaker|transformer|generator|load|cable|switch|isolator|fuse|ct|pt|arrester|motor|capacitor|label|line",
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
- For "add feeder X": add a circuit_breaker below the busbar + a load below it + connection
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

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()
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
    return res.json({
      elements: parsed.elements,
      connections: parsed.connections || connections,
      explanation: parsed.explanation || 'Changes applied',
    });

  } catch (err: any) {
    console.error('[SLD Chat] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI chat failed' });
  }
};
