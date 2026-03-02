import { Router } from 'express';
import * as pollingCtrl from '../controllers/polling.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/start', pollingCtrl.startAll);
router.post('/stop', pollingCtrl.stopAll);
router.post('/device/:deviceId/start', pollingCtrl.startDevice);
router.post('/device/:deviceId/stop', pollingCtrl.stopDevice);
router.get('/status', pollingCtrl.getStatus);
router.get('/stats', pollingCtrl.getStats);
router.get('/errors', pollingCtrl.getErrorLog);

export default router;
