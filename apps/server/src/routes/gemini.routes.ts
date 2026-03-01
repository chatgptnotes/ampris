import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  handleGenerateContent,
  handleGetInfographic,
  handleClearInfographic,
} from '../controllers/gemini.controller';

const router = Router();

// Rate limit: 10 requests per minute for AI content generation
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI generation requests, please try again later' },
});

// Rate limit: 3 image generations per minute (heavier operation)
const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many image generation requests, please try again later' },
});

router.post('/generate-content', geminiLimiter, handleGenerateContent);
router.get('/infographic', imageLimiter, handleGetInfographic);
router.delete('/infographic', handleClearInfographic);

export default router;
