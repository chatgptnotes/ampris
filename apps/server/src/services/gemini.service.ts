import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/environment';
import fs from 'fs';
import path from 'path';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export type ContentType = 'features' | 'infographic' | 'facts' | 'description';

const prompts: Record<ContentType, string> = {
  features: `Generate a JSON array of 6 feature descriptions for a SCADA (Supervisory Control and Data Acquisition) system used in electrical distribution substations (33/11kV). Each item should have "title" and "description" fields. Focus on real-time monitoring, alarm management, SLD visualization, protocol support, trend analysis, and security. Keep descriptions concise (2-3 sentences). Return ONLY valid JSON.`,

  infographic: `Generate a JSON object with infographic data for a SCADA system used in 33/11kV distribution substations. Include:
- "title": a catchy title
- "stats": array of 4 objects with "label", "value", "unit" (e.g., monitoring points, response time, uptime %)
- "benefits": array of 4 short benefit strings
Return ONLY valid JSON.`,

  facts: `Generate a JSON array of 5 interesting facts about SCADA systems in electrical distribution substations. Each item should have "fact" and "detail" fields. Cover topics like: history of SCADA, real-time data volumes, protocol standards (IEC 61850, DNP3), voltage monitoring, and smart grid evolution. Keep each fact to 2-3 sentences. Return ONLY valid JSON.`,

  description: `Write a concise 2-paragraph marketing description for GridVision SCADA - an open-source, web-based SCADA platform for 33/11kV distribution substation monitoring. Mention SVG-based single line diagrams, real-time WebSocket telemetry, alarm management, and multi-protocol support (Modbus, DNP3, IEC 61850). Return plain text, not JSON.`,
};

export async function generateContent(type: ContentType): Promise<string> {
  const client = getClient();

  const prompt = prompts[type];
  if (!prompt) {
    throw new Error(`Unknown content type: ${type}`);
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

// ── Image Generation via Gemini REST API ──

const CACHE_DIR = path.resolve(__dirname, '../../cache');
const INFOGRAPHIC_CACHE_FILE = path.join(CACHE_DIR, 'infographic.png');
const INFOGRAPHIC_META_FILE = path.join(CACHE_DIR, 'infographic.json');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

const INFOGRAPHIC_PROMPT = `Create a professional, visually stunning infographic poster for "GridVision SCADA" — a digital twin platform for 33/11kV electrical distribution substations.

The infographic should show:
1. A schematic digital twin representation of a 33/11kV substation with:
   - 33kV incoming power line at the top
   - Two horizontal bus bars (33kV red/maroon, 11kV green)
   - Two power transformers (8 MVA each) connecting the bus bars
   - 6 outgoing 11kV feeders at the bottom
   - Circuit breaker symbols (small squares) at key connection points

2. Overlay data panels showing real-time monitoring values:
   - Voltage: 33.1 kV / 11.0 kV
   - Total Load: 7.9 MW
   - Power Factor: 0.97
   - Transformer Oil Temp: 62°C / 58°C
   - System Uptime: 99.97%

3. Visual elements:
   - Glowing power flow lines/arrows showing electricity direction
   - Green status indicators for healthy equipment
   - A sleek dark navy blue (#0F172A) background
   - Blue accent glows and highlights
   - Modern glassmorphism UI cards for data overlays
   - "DIGITAL TWIN" label at the top

Style: Futuristic, dark-themed, professional tech product visualization. Clean typography. Suitable for a SaaS product landing page hero section. Aspect ratio approximately 4:3. No watermarks or text artifacts.`;

export interface InfographicResult {
  imageBase64: string;
  mimeType: string;
  cached: boolean;
}

/**
 * Get the cached infographic or generate a new one via Gemini image generation.
 */
export async function getOrGenerateInfographic(forceRegenerate = false): Promise<InfographicResult> {
  ensureCacheDir();

  // Check cache first
  if (!forceRegenerate && fs.existsSync(INFOGRAPHIC_CACHE_FILE) && fs.existsSync(INFOGRAPHIC_META_FILE)) {
    try {
      const meta = JSON.parse(fs.readFileSync(INFOGRAPHIC_META_FILE, 'utf-8'));
      const imageBuffer = fs.readFileSync(INFOGRAPHIC_CACHE_FILE);
      const imageBase64 = imageBuffer.toString('base64');
      return {
        imageBase64,
        mimeType: meta.mimeType || 'image/png',
        cached: true,
      };
    } catch (err: any) {
      console.warn("[Gemini] operation failed:", err.message);
    }
  }

  // Generate via Gemini REST API (image generation model)
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // Try multiple model names for image generation
  const modelNames = [
    'gemini-2.0-flash-exp-image-generation',
  ];

  let lastError: Error | null = null;

  for (const modelName of modelNames) {
    try {
      console.log(`[Gemini] Attempting image generation with model: ${modelName}`);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: INFOGRAPHIC_PROMPT }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Gemini] Model ${modelName} failed (${response.status}):`, errorBody);
        lastError = new Error(`Gemini API error (${response.status}): ${errorBody}`);
        continue;
      }

      const data: any = await response.json();

      // Extract image from response parts
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        lastError = new Error('No candidates in Gemini response');
        continue;
      }

      const parts = candidates[0].content?.parts || [];
      let imageData: string | null = null;
      let mimeType = 'image/png';

      for (const part of parts) {
        if (part.inlineData) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!imageData) {
        lastError = new Error('No image data in Gemini response');
        continue;
      }

      // Cache to disk
      const imageBuffer = Buffer.from(imageData, 'base64');
      fs.writeFileSync(INFOGRAPHIC_CACHE_FILE, imageBuffer);
      fs.writeFileSync(
        INFOGRAPHIC_META_FILE,
        JSON.stringify({
          mimeType,
          model: modelName,
          generatedAt: new Date().toISOString(),
          prompt: INFOGRAPHIC_PROMPT.substring(0, 200) + '...',
        }),
      );

      console.log(`[Gemini] Infographic generated successfully with ${modelName} (${imageBuffer.length} bytes)`);

      return {
        imageBase64: imageData,
        mimeType,
        cached: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[Gemini] Model ${modelName} error:`, lastError.message);
      continue;
    }
  }

  throw lastError || new Error('Failed to generate infographic with all available models');
}

/**
 * Check if a cached infographic exists.
 */
export function hasInfographicCache(): boolean {
  return fs.existsSync(INFOGRAPHIC_CACHE_FILE) && fs.existsSync(INFOGRAPHIC_META_FILE);
}

/**
 * Delete the cached infographic.
 */
export function clearInfographicCache(): void {
  if (fs.existsSync(INFOGRAPHIC_CACHE_FILE)) fs.unlinkSync(INFOGRAPHIC_CACHE_FILE);
  if (fs.existsSync(INFOGRAPHIC_META_FILE)) fs.unlinkSync(INFOGRAPHIC_META_FILE);
}
