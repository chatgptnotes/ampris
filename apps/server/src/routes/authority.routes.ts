import { Router } from 'express';
import * as ctrl from '../controllers/authority.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', ctrl.createAuthority);
router.get('/', ctrl.getAuthorities);
router.get('/check', ctrl.checkAuthority);
router.get('/active', ctrl.getActiveOperators);
router.get('/:id', ctrl.getAuthority);
router.put('/:id', ctrl.updateAuthority);
router.delete('/:id', ctrl.deleteAuthority);

export default router;
