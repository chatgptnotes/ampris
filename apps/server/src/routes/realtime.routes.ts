import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { realtimeService } from '../services/realtime.service';

const router = Router();

router.use(authenticate);

/**
 * GET /api/realtime/snapshot
 * Returns all current real-time values.
 */
router.get('/snapshot', (_req: Request, res: Response) => {
  res.json(realtimeService.getAllCurrentValues());
});

/**
 * GET /api/realtime/tags
 * Returns all available tag names with metadata (unit, description, type).
 */
router.get('/tags', (_req: Request, res: Response) => {
  const tags = realtimeService.getTagList();
  res.json(tags);
});

export default router;
