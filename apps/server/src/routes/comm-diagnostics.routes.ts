import { Router } from 'express';
import * as ctrl from '../controllers/comm-diagnostics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/summary', ctrl.getSummary);
router.get('/device/:deviceId', ctrl.getDeviceStats);
router.get('/device/:deviceId/logs', ctrl.getDeviceLogs);
router.get('/device/:deviceId/traffic', ctrl.getDeviceTraffic);
router.post('/device/:deviceId/ping', ctrl.pingDevice);
router.post('/reset', ctrl.resetAll);
router.get('/network-map', ctrl.getNetworkMap);

export default router;
