import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware';
import { generateSLD, queueSLDGeneration, getSLDStatus } from '../controllers/sld-generation.controller';

const router = Router();

// Async: queue job (returns jobId immediately), poll for status
router.post('/queue', optionalAuth, ...queueSLDGeneration);
router.get('/status/:jobId', optionalAuth, getSLDStatus);

// Legacy sync endpoint
router.post('/generate', optionalAuth, ...generateSLD);

export default router;

// AI chat to modify existing SLD
import { chatSLD } from '../controllers/sld-generation.controller';
router.post('/chat', optionalAuth, chatSLD);
