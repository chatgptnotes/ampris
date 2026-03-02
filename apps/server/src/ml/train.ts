/**
 * Standalone Training Script
 *
 * Usage: npx tsx apps/server/src/ml/train.ts
 *
 * Trains all ML models, prints metrics, saves to data/models/
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateLoadData, type LoadDataPoint } from './generate-load-data';
import { trainAllModels } from './load-forecaster';
import { trainAnomalyDetector, detectAnomalies } from './anomaly-detector';

const DATA_DIR = path.join(__dirname, '../../data');
const MODELS_DIR = path.join(DATA_DIR, 'models');

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  GridVision ML — Full Training Pipeline  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const startTime = Date.now();

  // 1. Load or generate data
  let data2024: LoadDataPoint[];
  let data2025: LoadDataPoint[];

  const load2024Path = path.join(DATA_DIR, 'load_data_2024.json');
  const load2025Path = path.join(DATA_DIR, 'load_data_2025.json');

  if (fs.existsSync(load2024Path)) {
    console.log('[Data] Loading existing 2024 load data...');
    data2024 = JSON.parse(fs.readFileSync(load2024Path, 'utf-8'));
  } else {
    console.log('[Data] Generating 2024 load data...');
    data2024 = generateLoadData(2024);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(load2024Path, JSON.stringify(data2024));
  }

  if (fs.existsSync(load2025Path)) {
    console.log('[Data] Loading existing 2025 load data...');
    data2025 = JSON.parse(fs.readFileSync(load2025Path, 'utf-8'));
  } else {
    console.log('[Data] Generating 2025 load data...');
    data2025 = generateLoadData(2025);
    fs.writeFileSync(load2025Path, JSON.stringify(data2025));
  }

  console.log(`[Data] Total: ${data2024.length + data2025.length} data points\n`);

  // 2. Data statistics
  const allData = [...data2024, ...data2025];
  const loads = allData.map(p => p.load_mw);
  const temps = allData.map(p => p.temperature);

  console.log('─── Data Statistics ──────────────────────');
  console.log(`  Load: min=${Math.min(...loads).toFixed(2)} MW, max=${Math.max(...loads).toFixed(2)} MW, avg=${(loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(2)} MW`);
  console.log(`  Temp: min=${Math.min(...temps).toFixed(1)}°C, max=${Math.max(...temps).toFixed(1)}°C`);
  console.log(`  Weekdays: ${allData.filter(p => !p.is_weekend).length}, Weekends: ${allData.filter(p => p.is_weekend).length}`);
  console.log(`  Holidays: ${allData.filter(p => p.is_holiday).length}`);
  console.log('');

  // 3. Train forecasting models
  // Split: 2024 + first 10 months of 2025 = train; last 2 months = validation
  const valStart = new Date('2025-11-01').getTime();
  const trainData = [...data2024, ...data2025.filter(p => new Date(p.timestamp).getTime() < valStart)];
  const valData = data2025.filter(p => new Date(p.timestamp).getTime() >= valStart);

  console.log('─── Training Forecasting Models ──────────');
  console.log(`  Train set: ${trainData.length} points`);
  console.log(`  Validation set: ${valData.length} points\n`);

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const models = trainAllModels(trainData, valData);
  fs.writeFileSync(path.join(MODELS_DIR, 'ensemble.json'), JSON.stringify(models, null, 0));

  console.log('\n─── Final Model Metrics ──────────────────');
  console.log(`  Moving Average:  RMSE=${models.movingAverage.metrics.rmse}, MAPE=${models.movingAverage.metrics.mape}%, R²=${models.movingAverage.metrics.r2}`);
  console.log(`  Regression:      RMSE=${models.regression.metrics.rmse}, MAPE=${models.regression.metrics.mape}%, R²=${models.regression.metrics.r2}`);
  console.log(`  Holt-Winters:    RMSE=${models.holtWinters.metrics.rmse}, MAPE=${models.holtWinters.metrics.mape}%, R²=${models.holtWinters.metrics.r2}`);
  console.log(`  Ensemble:        RMSE=${models.ensemble.metrics.rmse}, MAPE=${models.ensemble.metrics.mape}%, R²=${models.ensemble.metrics.r2}`);
  console.log(`  Ensemble Weights: MA=${models.ensemble.weights.movingAverage}, Reg=${models.ensemble.weights.regression}, HW=${models.ensemble.weights.holtWinters}`);

  // 4. Train anomaly detector
  console.log('\n─── Training Anomaly Detector ────────────');
  const anomalyModel = trainAnomalyDetector(allData);
  fs.writeFileSync(path.join(MODELS_DIR, 'anomaly_detector.json'), JSON.stringify(anomalyModel, null, 0));

  // Run on recent data to find anomalies
  const recentData = data2025.slice(-2880); // Last 30 days (96 pts/day × 30)
  const anomalies = detectAnomalies(anomalyModel, recentData, 0.3);
  console.log(`  Detected ${anomalies.length} anomalies in last 30 days`);
  console.log(`    Critical: ${anomalies.filter(a => a.severity === 'critical').length}`);
  console.log(`    Warning: ${anomalies.filter(a => a.severity === 'warning').length}`);

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Training complete in ${elapsed}s`);
  console.log(`  Models saved to: ${MODELS_DIR}/`);
  console.log(`    - ensemble.json (${(fs.statSync(path.join(MODELS_DIR, 'ensemble.json')).size / 1024).toFixed(1)} KB)`);
  console.log(`    - anomaly_detector.json (${(fs.statSync(path.join(MODELS_DIR, 'anomaly_detector.json')).size / 1024).toFixed(1)} KB)`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('Training failed:', e);
  process.exit(1);
});
