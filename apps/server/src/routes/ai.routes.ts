import { Router } from 'express';
import * as aiCtrl from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Load Forecasting
router.get('/load-forecast', aiCtrl.getLoadForecast);
router.get('/load-duration', aiCtrl.getLoadDurationCurve);
router.get('/demand-response', aiCtrl.getDemandResponse);

// Equipment Health
router.get('/equipment-health', aiCtrl.getEquipmentHealth);
router.get('/anomalies', aiCtrl.getAnomalies);

// Alarm Analysis
router.get('/alarm-analysis', aiCtrl.getAlarmAnalysis);

// Predictive Maintenance
router.get('/maintenance', aiCtrl.getMaintenanceTasks);
router.get('/spare-parts', aiCtrl.getSpareParts);
router.get('/cost-analysis', aiCtrl.getCostAnalysis);

// Power Quality
router.get('/power-quality', aiCtrl.getPowerQuality);

// AI Operations Center
router.get('/daily-report', aiCtrl.getDailyReport);
router.post('/what-if', aiCtrl.postWhatIf);
router.post('/chat', aiCtrl.postChat);

export default router;
