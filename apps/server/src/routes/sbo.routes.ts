import { Router } from 'express';
import * as ctrl from '../controllers/sbo.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/configs', ctrl.getSBOConfigs);
router.post('/configs', ctrl.createSBOConfig);
router.put('/configs/:id', ctrl.updateSBOConfig);
router.delete('/configs/:id', ctrl.deleteSBOConfig);
router.post('/select', ctrl.selectTag);
router.post('/operate', ctrl.operateTag);
router.post('/cancel', ctrl.cancelSelection);
router.get('/status', ctrl.getSBOStatus);

export default router;
