import { Router } from 'express';
import * as deviceCtrl from '../controllers/device.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', deviceCtrl.createDevice);
router.get('/', deviceCtrl.getDevices);
router.get('/relay-templates', deviceCtrl.getRelayTemplates);
router.get('/serial-ports', deviceCtrl.getSerialPorts);
router.post('/scan', deviceCtrl.scanDevices);
router.get('/:id', deviceCtrl.getDevice);
router.put('/:id', deviceCtrl.updateDevice);
router.delete('/:id', deviceCtrl.deleteDevice);
router.post('/:id/test-connection', deviceCtrl.testConnection);
router.get('/:id/tags', deviceCtrl.getDeviceTags);
router.post('/:id/generate-tags', deviceCtrl.generateTags);

export default router;
