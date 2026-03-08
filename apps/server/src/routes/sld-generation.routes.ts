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
import { chatSLD, generateSLDFromText, analyzeSLDImage, preGenerationChat } from '../controllers/sld-generation.controller';
router.post('/chat', optionalAuth, chatSLD);

// Text-to-SLD: generate from description (no image needed)
router.post('/generate-text', optionalAuth, generateSLDFromText);

// Pre-generation: analyze uploaded image → describe understanding
router.post('/analyze', optionalAuth, analyzeSLDImage);

// Pre-generation: chat to refine requirements before generating
router.post('/pre-chat', optionalAuth, preGenerationChat);
