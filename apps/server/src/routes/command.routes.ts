import { Router } from 'express';
import * as ctrl from '../controllers/command.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', ctrl.createSequence);
router.get('/', ctrl.getSequences);
router.get('/executions', ctrl.getExecutions);
router.get('/executions/:id', ctrl.getExecution);
router.post('/executions/:id/confirm', ctrl.confirmStep);
router.post('/executions/:id/abort', ctrl.abortExecution);
router.get('/:id', ctrl.getSequence);
router.put('/:id', ctrl.updateSequence);
router.delete('/:id', ctrl.deleteSequence);
router.post('/:id/execute', ctrl.executeSequence);

export default router;
