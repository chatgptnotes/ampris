import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getAnalytics } from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate);
router.get('/', getAnalytics);

export default router;
