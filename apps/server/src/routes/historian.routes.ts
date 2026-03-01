import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { historianService } from '../services/historian.service';

const router = Router();

// All historian routes require authentication
router.use(authenticate);

/**
 * GET /api/historian/query?tags=TAG1,TAG2&from=<epoch_ms>&to=<epoch_ms>&interval=<ms>
 * Query ring buffer for recent data (last 1 hour). Fast, in-memory.
 */
router.get('/query', (req: Request, res: Response) => {
  const tagsParam = req.query.tags as string;
  const from = Number(req.query.from);
  const to = Number(req.query.to) || Date.now();
  const interval = req.query.interval ? Number(req.query.interval) : undefined;

  if (!tagsParam) {
    return res.status(400).json({ error: 'tags parameter is required' });
  }

  const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
  if (tags.length === 0) {
    return res.status(400).json({ error: 'At least one tag is required' });
  }
  if (tags.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 tags per query' });
  }

  const fromMs = from || Date.now() - 5 * 60 * 1000; // default last 5 minutes

  // Parse interval shorthand: 1s, 10s, 1m, 5m, 1h
  let intervalMs = interval;
  if (req.query.interval && typeof req.query.interval === 'string' && isNaN(Number(req.query.interval))) {
    const match = (req.query.interval as string).match(/^(\d+)(s|m|h)$/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      intervalMs = unit === 's' ? num * 1000 : unit === 'm' ? num * 60_000 : num * 3600_000;
    }
  }

  const data = historianService.queryRingBuffer(tags, fromMs, to, intervalMs);
  res.json(data);
});

/**
 * GET /api/historian/latest?tags=TAG1,TAG2
 * Get current (most recent) values for tags. Instant from memory.
 */
router.get('/latest', (req: Request, res: Response) => {
  const tagsParam = req.query.tags as string;

  if (!tagsParam) {
    // Return all latest
    return res.json(historianService.getAllLatestValues());
  }

  const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
  res.json(historianService.getLatestValues(tags));
});

/**
 * GET /api/historian/statistics?tag=TAG1&from=<epoch_ms>&to=<epoch_ms>
 * Compute min, max, avg, stddev for a tag over a time range.
 */
router.get('/statistics', (req: Request, res: Response) => {
  const tag = req.query.tag as string;
  if (!tag) {
    return res.status(400).json({ error: 'tag parameter is required' });
  }

  const from = Number(req.query.from) || Date.now() - 60 * 60 * 1000; // default last 1 hour
  const to = Number(req.query.to) || Date.now();

  const stats = historianService.computeStatistics(tag, from, to);
  res.json(stats);
});

export default router;
