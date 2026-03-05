import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/environment';

// Zod schemas matching the SLDLayout interface
const SLDElementSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  type: z.enum([
    'CIRCUIT_BREAKER', 'ISOLATOR', 'EARTH_SWITCH', 'POWER_TRANSFORMER',
    'CURRENT_TRANSFORMER', 'POTENTIAL_TRANSFORMER', 'BUS_BAR',
    'FEEDER_LINE', 'LIGHTNING_ARRESTER', 'CAPACITOR_BANK',
  ]),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  label: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SLDConnectionSchema = z.object({
  id: z.string(),
  fromElementId: z.string(),
  fromPoint: z.string(),
  toElementId: z.string(),
  toPoint: z.string(),
  voltageLevel: z.number(),
});

const SLDLayoutSchema = z.object({
  id: z.string(),
  substationId: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  elements: z.array(SLDElementSchema),
  connections: z.array(SLDConnectionSchema),
});

type SLDLayout = z.infer<typeof SLDLayoutSchema>;

const SYSTEM_PROMPT = `You are an expert electrical engineer specializing in Single Line Diagrams (SLDs) for power substations. You analyze images of hand-drawn, scanned, or digital SLD diagrams and produce a structured JSON representation.

You MUST return ONLY valid JSON matching this exact schema (no markdown, no explanation, just JSON):

{
  "id": "string (UUID)",
  "substationId": "string (UUID)",
  "name": "string (descriptive name for the substation)",
  "width": 1200,
  "height": 800,
  "elements": [
    {
      "id": "string (UUID)",
      "equipmentId": "string (UUID)",
      "type": "EQUIPMENT_TYPE",
      "x": number,
      "y": number,
      "rotation": 0,
      "label": "string (tag/name visible on diagram)",
      "metadata": { ... }
    }
  ],
  "connections": [
    {
      "id": "string (UUID)",
      "fromElementId": "string (element id)",
      "fromPoint": "top|bottom|left|right",
      "toElementId": "string (element id)",
      "toPoint": "top|bottom|left|right",
      "voltageLevel": number
    }
  ]
}

EQUIPMENT TYPES (use these exact strings):
- CIRCUIT_BREAKER: Square with X symbol, used for switching/protection. Label like "CB1", "INC1", "BSC"
- ISOLATOR: Blade switch symbol, used for isolation. Label like "ISO1", "DS1"
- EARTH_SWITCH: Switch to ground symbol. Label like "ES1"
- POWER_TRANSFORMER: Two overlapping circles, steps voltage up/down. Label like "TR-1", "T1". Metadata: { "hvVoltage": 33, "lvVoltage": 11, "mva": 8 }
- CURRENT_TRANSFORMER: Small circle on conductor. Label like "CT1"
- POTENTIAL_TRANSFORMER: Small circle with connection. Label like "PT1"
- BUS_BAR: Thick horizontal line carrying power. Label like "33kV Bus 1", "11kV Bus". Metadata: { "busWidth": 300, "voltageKv": 33 }
- FEEDER_LINE: Outgoing line with arrow, delivers power to loads. Label like "F1", "Feeder 1"
- LIGHTNING_ARRESTER: Zigzag symbol to ground. Label like "LA1"
- CAPACITOR_BANK: Two parallel plates symbol. Label like "CAP1"

COORDINATE SYSTEM:
- Canvas is 1200 x 800 pixels
- Place HV (higher voltage) bus bars in the top portion (y: 100-150)
- Place LV (lower voltage) bus bars in the lower portion (y: 400-450)
- Place transformers between the bus bars (y: 200-350)
- Place feeders below the LV bus (y: 450-600)
- Spread elements horizontally with adequate spacing (min 80px between elements)
- Bus bars should span horizontally (typical width 300-600px in metadata.busWidth)

VOLTAGE LEVELS:
- 132kV: Extra High Voltage (use voltageLevel: 132)
- 33kV: High Voltage (use voltageLevel: 33)
- 11kV: Medium Voltage (use voltageLevel: 11)
- Detect voltage levels from labels, symbols, and context in the diagram

CONNECTION RULES:
- Connect elements that are electrically linked in the diagram
- fromPoint/toPoint indicate which side of the element the connection attaches to (top, bottom, left, right)
- Set voltageLevel based on the voltage zone the connection is in
- Bus bar connections typically use "top" or "bottom" points
- Transformer HV side connects from "top", LV side from "bottom"

Generate unique UUIDs for all id fields. Analyze the image carefully and produce accurate, complete JSON.`;

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }
  return text.trim();
}

function ensureUUIDs(layout: SLDLayout): SLDLayout {
  const idMap = new Map<string, string>();

  const ensureId = (original: string): string => {
    if (!idMap.has(original)) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(original);
      idMap.set(original, isUUID ? original : uuidv4());
    }
    return idMap.get(original)!;
  };

  return {
    ...layout,
    id: ensureId(layout.id),
    substationId: ensureId(layout.substationId),
    elements: layout.elements.map((el) => ({
      ...el,
      id: ensureId(el.id),
      equipmentId: ensureId(el.equipmentId),
    })),
    connections: layout.connections.map((conn) => ({
      ...conn,
      id: ensureId(conn.id),
      fromElementId: ensureId(conn.fromElementId),
      toElementId: ensureId(conn.toElementId),
    })),
  };
}

export async function generateSLDFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<SLDLayout> {
  const apiKey = env.ANTHROPIC_API_KEY;
  const oauthToken = env.ANTHROPIC_OAUTH_TOKEN;

  if (!apiKey && !oauthToken) {
    throw new Error('Anthropic credentials not configured. Set ANTHROPIC_API_KEY or ANTHROPIC_OAUTH_TOKEN in your .env file.');
  }

  const client = apiKey
    ? new Anthropic({ apiKey })
    : new Anthropic({ authToken: oauthToken });

  const base64Image = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Analyze this Single Line Diagram image and return the JSON representation. Identify all equipment, connections, voltage levels, and labels visible in the diagram.',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const textContent = textBlock?.type === 'text' ? textBlock.text : null;
  if (!textContent) {
    throw new Error('No text response received from Claude');
  }

  const jsonStr = extractJSON(textContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${jsonStr.substring(0, 200)}...`);
  }

  const result = SLDLayoutSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Response does not match SLDLayout schema: ${result.error.message}`);
  }

  return ensureUUIDs(result.data);
}
