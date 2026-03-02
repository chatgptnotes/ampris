import { Router } from 'express';
import multer from 'multer';
import * as importCtrl from '../controllers/import.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// Import
router.post('/tags', upload.single('file'), importCtrl.importTags);
router.post('/tags/preview', upload.single('file'), importCtrl.previewImport);
router.post('/tags/template', importCtrl.downloadTemplate);

export default router;
