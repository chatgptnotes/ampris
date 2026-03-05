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
import analyticsRoutes from './routes/analytics.routes';
import importRoutes from './routes/import.routes';
import exportRoutes from './routes/export.routes';
import recipeRoutes from './routes/recipe.routes';
import reportTemplateRoutes from './routes/report-template.routes';
import commandRoutes from './routes/command.routes';
import interlockRoutes from './routes/interlock.routes';
import sboRoutes from './routes/sbo.routes';
import authorityRoutes from './routes/authority.routes';
import pollingRoutes from './routes/polling.routes';
import historianCompressionRoutes from './routes/historian-compression.routes';
import redundancyRoutes from './routes/redundancy.routes';
import commDiagnosticsRoutes from './routes/comm-diagnostics.routes';
import projectAlarmRoutes from './routes/project-alarm.routes';
import trendConfigRoutes from './routes/trend-config.routes';
import navigationRoutes from './routes/navigation.routes';
import customComponentRoutes from './routes/custom-components.routes';
import customReportRoutes from './routes/custom-report.routes';

const app = express();

// Security middleware
app.use(helmet());
const allowedOrigins = [
  env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://gridvision.vercel.app',
  'https://gridvision.in',
  'https://www.gridvision.in',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin === o || origin.endsWith('.gridvision.in') || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/interlocks', interlockRoutes);
app.use('/api/sbo', sboRoutes);
app.use('/api/authority', authorityRoutes);
app.use('/api/polling', pollingRoutes);
app.use('/api/historian-compression', historianCompressionRoutes);
app.use('/api/redundancy', redundancyRoutes);
app.use('/api/diagnostics', commDiagnosticsRoutes);
app.use('/api/project-alarms', projectAlarmRoutes);
app.use('/api/trend-configs', trendConfigRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/custom-components', customComponentRoutes);
app.use('/api/custom-reports', customReportRoutes);
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
