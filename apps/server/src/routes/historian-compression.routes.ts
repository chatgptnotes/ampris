import { Router } from 'express';
import * as ctrl from '../controllers/historian-compression.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/configs', ctrl.getConfigs);
router.post('/configs', ctrl.createConfig);
router.put('/configs/:id', ctrl.updateConfig);
router.delete('/configs/:id', ctrl.deleteConfig);
router.get('/stats', ctrl.getStats);
router.get('/query', ctrl.queryHistory);
router.post('/cleanup', ctrl.cleanup);
router.get('/storage', ctrl.getStorage);

export default router;
