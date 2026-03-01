import { Router } from 'express';
import * as tagCtrl from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Tag CRUD
router.post('/', tagCtrl.createTag);
router.get('/', tagCtrl.getTags);
router.get('/values/all', tagCtrl.getAllValues);
router.post('/bulk-set', tagCtrl.bulkSetValues);
router.post('/execute-script', tagCtrl.executeScript);
router.post('/by-name/set-value', tagCtrl.setTagValueByName);

// Scripts
router.get('/scripts', tagCtrl.getScripts);
router.post('/scripts', tagCtrl.createScript);
router.put('/scripts/:id', tagCtrl.updateScript);
router.delete('/scripts/:id', tagCtrl.deleteScript);

// Scenarios
router.get('/scenarios', tagCtrl.getScenarios);
router.post('/scenarios', tagCtrl.createScenario);
router.put('/scenarios/:id', tagCtrl.updateScenario);
router.delete('/scenarios/:id', tagCtrl.deleteScenario);

// Individual tag operations (after static routes)
router.get('/:id', tagCtrl.getTag);
router.put('/:id', tagCtrl.updateTag);
router.delete('/:id', tagCtrl.deleteTag);
router.post('/:id/set-value', tagCtrl.setTagValue);
router.get('/:id/history', tagCtrl.getTagHistory);

export default router;
