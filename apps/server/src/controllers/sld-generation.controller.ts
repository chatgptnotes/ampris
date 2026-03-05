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
