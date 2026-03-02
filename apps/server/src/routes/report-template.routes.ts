import { Router } from 'express';
import * as reportCtrl from '../controllers/report-template.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', reportCtrl.getTemplates);
router.post('/', reportCtrl.createTemplate);
router.put('/:id', reportCtrl.updateTemplate);
router.delete('/:id', reportCtrl.deleteTemplate);
router.post('/:templateId/generate', reportCtrl.generateReport);
router.get('/generated', reportCtrl.getGeneratedReports);
router.get('/generated/:id/download', reportCtrl.downloadReport);

export default router;
