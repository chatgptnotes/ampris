import { Router } from 'express';
import * as ctrl from '../controllers/redundancy.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/config', ctrl.getConfig);
router.post('/config', ctrl.upsertConfig);
router.post('/promote', ctrl.promote);
router.post('/demote', ctrl.demote);
router.get('/status', ctrl.getStatus);
router.get('/events', ctrl.getEvents);
router.post('/test-failover', ctrl.testFailover);

export default router;
