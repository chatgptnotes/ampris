import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/environment';

import authRoutes from './routes/auth.routes';
import substationRoutes from './routes/substation.routes';
import alarmRoutes from './routes/alarm.routes';
import trendRoutes from './routes/trend.routes';
import controlRoutes from './routes/control.routes';
import reportRoutes from './routes/report.routes';
import sldGenerationRoutes from './routes/sld-generation.routes';
import geminiRoutes from './routes/gemini.routes';
import historianRoutes from './routes/historian.routes';
import realtimeRoutes from './routes/realtime.routes';
import projectRoutes from './routes/project.routes';
import tagRoutes from './routes/tag.routes';
import deviceRoutes from './routes/device.routes';
import aiRoutes from './routes/ai.routes';
import importRoutes from './routes/import.routes';
import exportRoutes from './routes/export.routes';
import recipeRoutes from './routes/recipe.routes';
import reportTemplateRoutes from './routes/report-template.routes';
import commandRoutes from './routes/command.routes';
import interlockRoutes from './routes/interlock.routes';
import sboRoutes from './routes/sbo.routes';
import authorityRoutes from './routes/authority.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/substations', substationRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/trends', trendRoutes);
app.use('/api/control', controlRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sld', sldGenerationRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/historian', historianRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/interlocks', interlockRoutes);
app.use('/api/sbo', sboRoutes);
app.use('/api/authority', authorityRoutes);
app.use('/api/data-points', (_req, res) => {
  import('./controllers/substation.controller').then((ctrl) => ctrl.getDataPoints(_req, res));
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
