import { Router } from 'express';
import * as ctrl from '../controllers/interlock.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', ctrl.createInterlock);
router.get('/', ctrl.getInterlocks);
router.get('/check', ctrl.checkInterlock);
router.get('/events', ctrl.getInterlockEvents);
router.get('/:id', ctrl.getInterlock);
router.put('/:id', ctrl.updateInterlock);
router.delete('/:id', ctrl.deleteInterlock);
router.post('/:id/bypass', ctrl.bypassInterlock);

export default router;
