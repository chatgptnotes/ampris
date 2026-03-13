import { Router } from 'express';
import * as relayExplorerCtrl from '../controllers/relay-explorer.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Discovery
router.post('/discover', relayExplorerCtrl.discover);
router.post('/test-connection', relayExplorerCtrl.testConnection);

// Modbus exploration
router.post('/modbus-read', relayExplorerCtrl.modbusRead);
router.post('/modbus-scan', relayExplorerCtrl.modbusScan);

// IEC 61850 MMS Browse (Phase 3)
router.post('/mms-browse', relayExplorerCtrl.mmsBrowse);
router.post('/mms-browse-full', relayExplorerCtrl.mmsBrowseFull);
router.post('/mms-discover-measurements', relayExplorerCtrl.mmsDiscoverMeasurements);
router.post('/mms-export-icd', relayExplorerCtrl.mmsExportICD);
router.get('/ln-classes', relayExplorerCtrl.getLNClasses);

// Templates
router.get('/templates', relayExplorerCtrl.getTemplates);
router.get('/templates/:model', relayExplorerCtrl.getTemplateRegisters);

// Export
router.post('/export-tags', relayExplorerCtrl.exportTags);

export default router;
