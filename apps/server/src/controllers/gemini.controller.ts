import { Request, Response } from 'express';
import {
  generateContent,
  getOrGenerateInfographic,
  clearInfographicCache,
  type ContentType,
} from '../services/gemini.service';

const validTypes: ContentType[] = ['features', 'infographic', 'facts', 'description'];

export async function handleGenerateContent(req: Request, res: Response) {
  try {
    const { type } = req.body;

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid content type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const content = await generateContent(type as ContentType);

    // Try to parse as JSON if applicable
    let parsed: unknown = content;
    if (type !== 'description') {
      try {
        // Strip markdown code fences if present
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = content;
      }
    }

    res.json({ type, content: parsed });
  } catch (error) {
    console.error('Gemini generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate content';
    res.status(500).json({ error: message });
  }
}

/**
 * GET /api/gemini/infographic
 * Returns a Gemini-generated infographic image as a data URI.
 * Caches the result on disk — subsequent requests serve the cached image instantly.
 * Pass ?regenerate=true to force a fresh generation.
 */
export async function handleGetInfographic(req: Request, res: Response) {
  try {
    const forceRegenerate = req.query.regenerate === 'true';
    const result = await getOrGenerateInfographic(forceRegenerate);

    res.json({
      image: `data:${result.mimeType};base64,${result.imageBase64}`,
      mimeType: result.mimeType,
      cached: result.cached,
    });
  } catch (error) {
    console.error('Infographic generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate infographic';
    res.status(500).json({ error: message });
  }
}

/**
 * DELETE /api/gemini/infographic
 * Clears the cached infographic image.
 */
export async function handleClearInfographic(_req: Request, res: Response) {
  try {
    clearInfographicCache();
    res.json({ message: 'Infographic cache cleared' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
}
