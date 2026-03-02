import { Router } from 'express';
import * as importCtrl from '../controllers/import.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/tags', importCtrl.exportTags);
router.get('/tag-history', importCtrl.exportTagHistory);
router.get('/alarms', importCtrl.exportAlarms);
router.get('/audit', importCtrl.exportAudit);

export default router;
