/**
 * ML Module — Initialization & Cached Model Access
 *
 * On server startup: loads or trains models, caches in memory.
 * Provides getModels() / getAnomalyModel() / getLoadData() for controllers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateLoadData, type LoadDataPoint } from './generate-load-data';
import { trainAllModels, type TrainedModels } from './load-forecaster';
import { trainAnomalyDetector, type AnomalyDetectorModel } from './anomaly-detector';

// ─── Paths ─────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '../../data');
const MODELS_DIR = path.join(DATA_DIR, 'models');

const PATHS = {
  weather2024: path.join(DATA_DIR, 'weather_nagpur_2024.json'),
  weather2025: path.join(DATA_DIR, 'weather_nagpur_2025.json'),
  load2024: path.join(DATA_DIR, 'load_data_2024.json'),
  load2025: path.join(DATA_DIR, 'load_data_2025.json'),
  ensemble: path.join(MODELS_DIR, 'ensemble.json'),
  anomalyDetector: path.join(MODELS_DIR, 'anomaly_detector.json'),
};

// ─── In-memory Cache ───────────────────────────────

let cachedModels: TrainedModels | null = null;
let cachedAnomalyModel: AnomalyDetectorModel | null = null;
let cachedLoadData2024: LoadDataPoint[] | null = null;
let cachedLoadData2025: LoadDataPoint[] | null = null;
let initialized = false;

// ─── Getters ───────────────────────────────────────

export function getModels(): TrainedModels {
  if (!cachedModels) throw new Error('ML models not initialized. Call initML() first.');
  return cachedModels;
}

export function getAnomalyModel(): AnomalyDetectorModel {
  if (!cachedAnomalyModel) throw new Error('Anomaly detector not initialized. Call initML() first.');
  return cachedAnomalyModel;
}

export function getLoadData(year?: number): LoadDataPoint[] {
  if (year === 2024) return cachedLoadData2024 || [];
  if (year === 2025) return cachedLoadData2025 || [];
  return [...(cachedLoadData2024 || []), ...(cachedLoadData2025 || [])];
}

export function isInitialized(): boolean {
  return initialized;
}

// ─── Data Loading / Generation ─────────────────────

function ensureLoadData(): { data2024: LoadDataPoint[]; data2025: LoadDataPoint[] } {
  let data2024: LoadDataPoint[];
  let data2025: LoadDataPoint[];

  if (fs.existsSync(PATHS.load2024)) {
    console.log('  Loading existing 2024 load data...');
    data2024 = JSON.parse(fs.readFileSync(PATHS.load2024, 'utf-8'));
  } else {
    console.log('  Generating 2024 load data...');
    data2024 = generateLoadData(2024);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PATHS.load2024, JSON.stringify(data2024));
  }

  if (fs.existsSync(PATHS.load2025)) {
    console.log('  Loading existing 2025 load data...');
    data2025 = JSON.parse(fs.readFileSync(PATHS.load2025, 'utf-8'));
  } else {
    console.log('  Generating 2025 load data...');
    data2025 = generateLoadData(2025);
    fs.writeFileSync(PATHS.load2025, JSON.stringify(data2025));
  }

  console.log(`  Loaded ${data2024.length + data2025.length} total data points.`);
  return { data2024, data2025 };
}

// ─── Model Training ────────────────────────────────

function trainAndSave(data2024: LoadDataPoint[], data2025: LoadDataPoint[]): {
  models: TrainedModels;
  anomalyModel: AnomalyDetectorModel;
} {
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  // Split: train on 2024 + first 10 months of 2025, validate on last 2 months of 2025
  const valStart = new Date('2025-11-01').getTime();
  const trainData = [...data2024, ...data2025.filter(p => new Date(p.timestamp).getTime() < valStart)];
  const valData = data2025.filter(p => new Date(p.timestamp).getTime() >= valStart);

  console.log('\n[ML] Training forecasting models...');
  const models = trainAllModels(trainData, valData);
  fs.writeFileSync(PATHS.ensemble, JSON.stringify(models, null, 0));
  console.log('  Saved to', PATHS.ensemble);

  console.log('\n[ML] Training anomaly detector...');
  const anomalyModel = trainAnomalyDetector([...data2024, ...data2025]);
  fs.writeFileSync(PATHS.anomalyDetector, JSON.stringify(anomalyModel, null, 0));
  console.log('  Saved to', PATHS.anomalyDetector);

  return { models, anomalyModel };
}

// ─── Initialization ────────────────────────────────

export async function initML(): Promise<void> {
  if (initialized) return;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  GridVision ML Engine — Initializing ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Step 1: Ensure load data exists
  const { data2024, data2025 } = ensureLoadData();
  cachedLoadData2024 = data2024;
  cachedLoadData2025 = data2025;

  // Step 2: Load or train models
  if (fs.existsSync(PATHS.ensemble) && fs.existsSync(PATHS.anomalyDetector)) {
    console.log('\n[ML] Loading pre-trained models...');
    try {
      cachedModels = JSON.parse(fs.readFileSync(PATHS.ensemble, 'utf-8'));
      cachedAnomalyModel = JSON.parse(fs.readFileSync(PATHS.anomalyDetector, 'utf-8'));
      console.log(`  Models loaded (trained at ${cachedModels!.trainedAt})`);
      console.log(`  Ensemble MAPE: ${cachedModels!.ensemble.metrics.mape}%`);
    } catch (e) {
      console.warn('  Failed to load models, retraining...');
      const result = trainAndSave(data2024, data2025);
      cachedModels = result.models;
      cachedAnomalyModel = result.anomalyModel;
    }
  } else {
    const result = trainAndSave(data2024, data2025);
    cachedModels = result.models;
    cachedAnomalyModel = result.anomalyModel;
  }

  initialized = true;
  console.log('\n[ML] Engine ready.\n');
}
