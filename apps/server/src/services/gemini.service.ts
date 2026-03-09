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

// ── Digital Twin Generation ──────────────────────────────────────────────────

/**
 * Build a detailed prompt from actual SLD elements for a photorealistic 3D digital twin.
 */
export function buildDigitalTwinPrompt(projectName: string, elements: any[]): string {
  // Categorize elements
  const transformers = elements.filter((e: any) => ['Transformer', 'AutoTransformer'].includes(e.type));
  const breakers = elements.filter((e: any) => ['VacuumCB', 'SF6CB', 'ACB', 'CB', 'MCCB'].includes(e.type));
  const busbars = elements.filter((e: any) => ['BusBar', 'DoubleBusBar'].includes(e.type));
  const loads = elements.filter((e: any) => ['GenericLoad', 'ResistiveLoad', 'InductiveLoad', 'Motor'].includes(e.type));
  const generators = elements.filter((e: any) => ['Generator', 'SolarInverter'].includes(e.type));
  const isolators = elements.filter((e: any) => ['Isolator', 'EarthSwitch'].includes(e.type));
  const cts = elements.filter((e: any) => ['CT', 'PT', 'InstrumentTransformer'].includes(e.type));
  const arresters = elements.filter((e: any) => ['LightningArrester'].includes(e.type));
  const capacitors = elements.filter((e: any) => ['CapacitorBank'].includes(e.type));

  // Extract voltage levels from busbar labels
  const voltages = busbars
    .map((b: any) => b.properties?.label || '')
    .filter(Boolean)
    .join(', ');

  // Build transformer descriptions
  const trDesc = transformers.map((t: any, i: number) => {
    const label = t.properties?.label || `Transformer ${i + 1}`;
    return label;
  }).join(', ');

  // Build load/feeder descriptions
  const loadDesc = loads.map((l: any) => l.properties?.label || 'Load').join(', ');

  const brekerLabels = breakers.slice(0, 10).map((b: any) => b.properties?.label || b.type).join(', ');

  return `Create a hyper-realistic, cinematic 3D rendering of an outdoor electrical power distribution substation — a "digital twin" visualization for "${projectName}".

EXACT EQUIPMENT TO SHOW (based on the real Single Line Diagram):
- ${busbars.length} bus bar${busbars.length !== 1 ? 's' : ''}: ${voltages || 'high voltage bus sections'}
- ${transformers.length} power transformer${transformers.length !== 1 ? 's' : ''}: ${trDesc || 'oil-filled power transformers'}
- ${breakers.length} circuit breaker${breakers.length !== 1 ? 's' : ''}: ${brekerLabels || 'vacuum/SF6 circuit breakers'}
- ${isolators.length} isolator${isolators.length !== 1 ? 's' : ''} and earth switches
- ${cts.length} current/potential transformer${cts.length !== 1 ? 's' : ''}
- ${arresters.length} lightning arrester${arresters.length !== 1 ? 's' : ''}
- ${loads.length} outgoing feeder${loads.length !== 1 ? 's' : ''}: ${loadDesc || 'distribution feeders'}
${generators.length > 0 ? `- ${generators.length} generator/solar source` : ''}
${capacitors.length > 0 ? `- ${capacitors.length} capacitor bank` : ''}

SCENE COMPOSITION:
- Aerial isometric view (30-degree angle from above) of the entire substation yard
- Steel lattice gantry structures supporting the bus bars and overhead conductors
- Oil-filled power transformers with cooling fins, conservator tanks, bushings, and marshalling boxes
- Porcelain/polymer insulator bushings in correct colors (brown/gray)
- Circuit breaker cabinets with operating mechanisms, SF6 gas monitoring gauges
- Underground cable trenches with cable trays visible
- Control building in the background with SCADA antenna/dishes on roof
- Gravel ground surface with concrete equipment pads
- Chain-link perimeter fencing with barbed wire
- Proper earthing grid visible (copper conductor strips)
- Oil containment bunds around transformers
- Outdoor lighting poles with LED flood lights

LIGHTING & ATMOSPHERE:
- Golden hour lighting (late afternoon sun, warm directional light)
- Soft shadows with ambient occlusion
- Slight atmospheric haze for depth
- Clean blue sky with wispy clouds
- The substation should look operational — energized indicator lights glowing

DIGITAL TWIN OVERLAY (subtle holographic elements):
- Faint blue holographic data labels floating above key equipment showing voltage/current values
- Thin glowing cyan wireframe outlines on transformers (digital twin effect)
- A subtle holographic grid on the ground plane
- Small green status dots on operational equipment

QUALITY: Photorealistic, 8K detail, Unreal Engine 5 quality, architectural visualization standard. No cartoon or illustrated style — this must look like a real photograph enhanced with subtle digital twin AR overlays. Aspect ratio 16:9.`;
}

/**
 * Generate a digital twin image for a specific project using Gemini.
 */
export async function generateDigitalTwin(
  projectId: string,
  projectName: string,
  elements: any[],
  forceRegenerate = false,
): Promise<InfographicResult> {
  ensureCacheDir();

  const cacheFile = path.join(CACHE_DIR, `digital-twin-${projectId}.png`);
  const metaFile = path.join(CACHE_DIR, `digital-twin-${projectId}.json`);

  // Check cache
  if (!forceRegenerate && fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      const imageBase64 = fs.readFileSync(cacheFile).toString('base64');
      return { imageBase64, mimeType: meta.mimeType || 'image/png', cached: true };
    } catch { /* regenerate */ }
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const prompt = buildDigitalTwinPrompt(projectName, elements);

  // Try models in order of preference
  const models = [
    'gemini-2.0-flash-exp-image-generation',
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[DigitalTwin] Generating with ${model} for project ${projectId}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[DigitalTwin] ${model} failed (${response.status}):`, errBody);
        lastError = new Error(`Gemini ${response.status}: ${errBody.slice(0, 200)}`);
        continue;
      }

      const data: any = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      let imageData: string | null = null;
      let mimeType = 'image/png';

      for (const part of parts) {
        if (part.inlineData) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!imageData) { lastError = new Error('No image in Gemini response'); continue; }

      // Cache
      fs.writeFileSync(cacheFile, Buffer.from(imageData, 'base64'));
      fs.writeFileSync(metaFile, JSON.stringify({
        mimeType, model, projectId, projectName,
        generatedAt: new Date().toISOString(),
        elementCount: elements.length,
      }));

      console.log(`[DigitalTwin] Generated successfully (${Buffer.from(imageData, 'base64').length} bytes)`);
      return { imageBase64: imageData, mimeType, cached: false };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error('Failed to generate digital twin image');
}

// ── Digital Twin VIDEO Generation (Veo 3.1) ─────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function buildVideoPrompt(projectName: string, elements: any[]): string {
  // Reuse the same element categorisation
  const transformers = elements.filter((e: any) => ['Transformer', 'AutoTransformer'].includes(e.type));
  const breakers = elements.filter((e: any) => ['VacuumCB', 'SF6CB', 'ACB', 'CB', 'MCCB'].includes(e.type));
  const busbars = elements.filter((e: any) => ['BusBar', 'DoubleBusBar'].includes(e.type));
  const loads = elements.filter((e: any) => ['GenericLoad', 'ResistiveLoad', 'InductiveLoad', 'Motor'].includes(e.type));

  const voltages = busbars.map((b: any) => b.properties?.label || '').filter(Boolean).join(', ');

  return `Cinematic aerial drone flyover of a real outdoor electrical power distribution substation "${projectName}".

The camera starts high above, slowly descending and orbiting around the substation yard in golden hour lighting.

EQUIPMENT VISIBLE:
- ${busbars.length} bus bars (${voltages || 'high voltage bus sections'}) supported by steel lattice gantry structures
- ${transformers.length} large oil-filled power transformers with cooling fins, conservator tanks, and porcelain bushings
- ${breakers.length} circuit breakers in metal-clad switchgear cabinets
- ${loads.length} outgoing feeder bays with cable terminations
- Current transformers, potential transformers, and lightning arresters on steel structures
- Underground cable trenches, gravel ground, concrete pads
- Chain-link perimeter fencing with barbed wire
- Control building in the background with SCADA antennas on the roof
- Outdoor LED flood lights on tall poles

ATMOSPHERE:
- Golden hour sunlight with warm directional lighting and long shadows
- Slight atmospheric haze for depth and cinematic feel
- Operational indicator lights glowing green on equipment
- Subtle electrical humming ambient sound
- Faint blue holographic data overlays floating above key equipment (digital twin AR effect)
- Thin cyan wireframe outlines on transformers

CAMERA: Smooth cinematic drone orbit, slow descent from aerial to eye-level, professional stabilized movement. Photorealistic, 8K detail quality.`;
}

/**
 * Start a Veo video generation for the digital twin.
 * Returns the operation name for polling.
 */
export async function startDigitalTwinVideo(
  projectId: string,
  projectName: string,
  elements: any[],
  forceRegenerate = false,
): Promise<{ operationName: string } | { cached: true; videoUrl: string }> {
  ensureCacheDir();

  const cacheFile = path.join(CACHE_DIR, `digital-twin-video-${projectId}.mp4`);
  const metaFile = path.join(CACHE_DIR, `digital-twin-video-${projectId}.json`);

  // Check cache
  if (!forceRegenerate && fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
    return { cached: true, videoUrl: `/gemini/digital-twin-video/${projectId}/file` };
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const prompt = buildVideoPrompt(projectName, elements);

  const url = `${BASE_URL}/models/veo-3.1-generate-preview:predictLongRunning`;

  console.log(`[DigitalTwinVideo] Starting Veo generation for project ${projectId}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: '16:9',
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[DigitalTwinVideo] Veo start failed (${response.status}):`, errBody);
    throw new Error(`Veo API error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const operationName = data.name;

  if (!operationName) {
    throw new Error('No operation name returned from Veo API');
  }

  // Save operation metadata
  fs.writeFileSync(metaFile, JSON.stringify({
    operationName,
    projectId,
    projectName,
    startedAt: new Date().toISOString(),
    status: 'generating',
  }));

  console.log(`[DigitalTwinVideo] Operation started: ${operationName}`);
  return { operationName };
}

/**
 * Check the status of a Veo video generation operation.
 * If done, downloads and caches the video.
 */
export async function checkVideoOperationStatus(
  projectId: string,
  operationName: string,
): Promise<{ done: boolean; videoUrl?: string; error?: string }> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `${BASE_URL}/${operationName}`;

  const response = await fetch(url, {
    headers: { 'x-goog-api-key': apiKey },
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[DigitalTwinVideo] Status check failed (${response.status}):`, errBody);
    throw new Error(`Status check failed (${response.status})`);
  }

  const data: any = await response.json();

  if (!data.done) {
    return { done: false };
  }

  // Check for errors
  if (data.error) {
    return { done: true, error: data.error.message || 'Video generation failed' };
  }

  // Extract video URI
  const samples = data.response?.generateVideoResponse?.generatedSamples;
  if (!samples || samples.length === 0) {
    return { done: true, error: 'No video generated' };
  }

  const videoUri = samples[0].video?.uri;
  if (!videoUri) {
    return { done: true, error: 'No video URI in response' };
  }

  // Download and cache the video
  console.log(`[DigitalTwinVideo] Downloading video from ${videoUri}`);
  const videoResponse = await fetch(videoUri, {
    headers: { 'x-goog-api-key': apiKey },
  });

  if (!videoResponse.ok) {
    return { done: true, error: `Failed to download video (${videoResponse.status})` };
  }

  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  const cacheFile = path.join(CACHE_DIR, `digital-twin-video-${projectId}.mp4`);
  const metaFile = path.join(CACHE_DIR, `digital-twin-video-${projectId}.json`);

  fs.writeFileSync(cacheFile, videoBuffer);
  fs.writeFileSync(metaFile, JSON.stringify({
    projectId,
    generatedAt: new Date().toISOString(),
    status: 'complete',
    size: videoBuffer.length,
  }));

  console.log(`[DigitalTwinVideo] Video cached (${videoBuffer.length} bytes)`);
  return { done: true, videoUrl: `/gemini/digital-twin-video/${projectId}/file` };
}

/**
 * Get the path to a cached video file.
 */
export function getVideoFilePath(projectId: string): string | null {
  const cacheFile = path.join(CACHE_DIR, `digital-twin-video-${projectId}.mp4`);
  return fs.existsSync(cacheFile) ? cacheFile : null;
}
