import { Request, Response } from 'express';
import { generateSLDFromImage } from '../services/sld-generation.service';
import { env } from '../config/environment';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function generateSLD(req: Request, res: Response): Promise<void> {
  try {
    if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_OAUTH_TOKEN) {
      res.status(503).json({
        error: 'SLD generation service is not configured. Set ANTHROPIC_API_KEY or ANTHROPIC_OAUTH_TOKEN in your .env file.',
      });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Please upload an image file.' });
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      res.status(400).json({
        error: `Unsupported file type: ${file.mimetype}. Supported types: JPEG, PNG, GIF, WebP.`,
      });
      return;
    }

    const layout = await generateSLDFromImage(file.buffer, file.mimetype);

    res.json({
      success: true,
      layout,
      metadata: {
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        generatedAt: new Date().toISOString(),
        user: req.user?.userId || 'anonymous',
      },
    });
  } catch (error) {
    console.error('SLD generation error:', error);
    const message = error instanceof Error ? error.message : 'SLD generation failed';
    res.status(500).json({ error: message });
  }
}
