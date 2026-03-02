/**
 * Load Forecaster — Pure TypeScript ML Models
 *
 * Model 1: Seasonal Moving Average with temperature correlation
 * Model 2: Multiple Linear Regression (OLS)
 * Model 3: Holt-Winters Triple Exponential Smoothing
 * Ensemble: Weighted average based on validation MAPE
 */

import type { LoadDataPoint } from './generate-load-data';

// ─── Types ─────────────────────────────────────────

export interface ForecastResult {
  timestamp: string;
  predicted: number;
  upperBound: number;
  lowerBound: number;
}

export interface ModelMetrics {
  rmse: number;
  mape: number;
  r2: number;
}

export interface RegressionModel {
  type: 'regression';
  coefficients: number[];   // [intercept, hour, dayOfWeek, month, temp, humidity, isHoliday, isWeekend, hour_sq, temp_sq]
  featureNames: string[];
  metrics: ModelMetrics;
}

export interface HoltWintersModel {
  type: 'holt_winters';
  alpha: number;
  beta: number;
  gamma: number;
  seasonalPeriod: number;
  level: number;
  trend: number;
  seasonal: number[];
  metrics: ModelMetrics;
}

export interface MovingAverageModel {
  type: 'moving_average';
  weeklyProfile: number[];   // 168 values (7 days × 24 hours)
  dailyProfile: number[];    // 24 values
  tempCoefficient: number;   // MW per °C above 30
  metrics: ModelMetrics;
}

export interface EnsembleModel {
  type: 'ensemble';
  weights: { regression: number; holtWinters: number; movingAverage: number };
  metrics: ModelMetrics;
}

export interface TrainedModels {
  regression: RegressionModel;
  holtWinters: HoltWintersModel;
  movingAverage: MovingAverageModel;
  ensemble: EnsembleModel;
  trainedAt: string;
}

// ─── Feature Extraction ────────────────────────────

function extractFeatures(point: LoadDataPoint): number[] {
  return [
    1,                                        // intercept
    point.hour,                               // hour of day
    point.day_of_week,                        // day of week
    point.month,                              // month
    point.temperature,                        // temperature °C
    point.humidity,                           // humidity %
    point.is_holiday ? 1 : 0,                 // is holiday
    point.is_weekend ? 1 : 0,                 // is weekend
    point.hour * point.hour / 24,             // hour squared (normalized)
    Math.max(0, point.temperature - 25) ** 2 / 100, // temp squared above 25 (AC nonlinear)
  ];
}

const FEATURE_NAMES = [
  'intercept', 'hour', 'dayOfWeek', 'month', 'temperature',
  'humidity', 'isHoliday', 'isWeekend', 'hourSquared', 'tempSquaredAbove25',
];

// ─── Matrix Math (inline) ──────────────────────────

/** Transpose a matrix */
function transpose(A: number[][]): number[][] {
  const rows = A.length, cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      T[j][i] = A[i][j];
  return T;
}

/** Matrix multiply: A (m×n) × B (n×p) → C (m×p) */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < n; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

/** Matrix × vector */
function matVecMul(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

/** Invert a square matrix using Gauss-Jordan elimination */
function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  // Augment with identity
  const aug: number[][] = M.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) {
      // Add regularization for near-singular
      aug[col][col] += 1e-6;
    }
    const pivotVal = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivotVal;

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map(row => row.slice(n));
}

// ─── Model 1: Moving Average + Seasonal ───────────

export function trainMovingAverage(data: LoadDataPoint[]): MovingAverageModel {
  // Compute average load for each hour of the week (168 slots)
  const weeklyBuckets: number[][] = Array.from({ length: 168 }, () => []);
  // Daily profile (24 slots)
  const dailyBuckets: number[][] = Array.from({ length: 24 }, () => []);

  for (const p of data) {
    const weekSlot = p.day_of_week * 24 + p.hour;
    weeklyBuckets[weekSlot].push(p.load_mw);
    dailyBuckets[p.hour].push(p.load_mw);
  }

  const weeklyProfile = weeklyBuckets.map(b =>
    b.length > 0 ? b.reduce((s, v) => s + v, 0) / b.length : 15
  );
  const dailyProfile = dailyBuckets.map(b =>
    b.length > 0 ? b.reduce((s, v) => s + v, 0) / b.length : 15
  );

  // Temperature correlation: simple linear fit for temp > 30
  const hotPoints = data.filter(p => p.temperature > 30);
  let tempCoeff = 0;
  if (hotPoints.length > 100) {
    const avgLoad = hotPoints.reduce((s, p) => s + p.load_mw, 0) / hotPoints.length;
    const avgTemp = hotPoints.reduce((s, p) => s + p.temperature, 0) / hotPoints.length;
    let num = 0, den = 0;
    for (const p of hotPoints) {
      num += (p.temperature - avgTemp) * (p.load_mw - avgLoad);
      den += (p.temperature - avgTemp) ** 2;
    }
    tempCoeff = den > 0 ? num / den : 0;
  }

  return {
    type: 'moving_average',
    weeklyProfile,
    dailyProfile,
    tempCoefficient: Math.round(tempCoeff * 1000) / 1000,
    metrics: { rmse: 0, mape: 0, r2: 0 }, // computed during validation
  };
}

export function predictMovingAverage(
  model: MovingAverageModel,
  hour: number, dayOfWeek: number, temperature: number
): number {
  const weekSlot = dayOfWeek * 24 + hour;
  let pred = model.weeklyProfile[weekSlot];

  // Temperature adjustment
  if (temperature > 30) {
    pred += model.tempCoefficient * (temperature - 30);
  }

  return Math.max(3, pred);
}

// ─── Model 2: Multiple Linear Regression (OLS) ────

export function trainRegression(data: LoadDataPoint[]): RegressionModel {
  const n = data.length;
  const numFeatures = FEATURE_NAMES.length;

  // Build X matrix and y vector
  const X: number[][] = data.map(p => extractFeatures(p));
  const y: number[] = data.map(p => p.load_mw);

  // OLS: β = (X'X)^(-1) X'y
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);

  // Add ridge regularization (λ = 0.01) to diagonal for numerical stability
  for (let i = 0; i < numFeatures; i++) {
    XtX[i][i] += 0.01;
  }

  const XtX_inv = invertMatrix(XtX);
  const Xty = matVecMul(Xt, y);
  const coefficients = matVecMul(XtX_inv, Xty);

  return {
    type: 'regression',
    coefficients,
    featureNames: FEATURE_NAMES,
    metrics: { rmse: 0, mape: 0, r2: 0 },
  };
}

export function predictRegression(model: RegressionModel, point: LoadDataPoint): number {
  const features = extractFeatures(point);
  let pred = 0;
  for (let i = 0; i < model.coefficients.length; i++) {
    pred += model.coefficients[i] * features[i];
  }
  return Math.max(3, pred);
}

// ─── Model 3: Holt-Winters Triple Exponential ─────

export function trainHoltWinters(data: LoadDataPoint[], seasonalPeriod: number = 96): HoltWintersModel {
  // 96 = 24 hours × 4 (15-min intervals) = daily seasonality
  const n = data.length;
  const y = data.map(p => p.load_mw);

  // Use first few complete seasons to initialize
  const numInitSeasons = Math.min(3, Math.floor(n / seasonalPeriod));
  if (numInitSeasons < 1) {
    return {
      type: 'holt_winters',
      alpha: 0.3, beta: 0.05, gamma: 0.1,
      seasonalPeriod,
      level: y[0] || 15,
      trend: 0,
      seasonal: new Array(seasonalPeriod).fill(1),
      metrics: { rmse: 0, mape: 0, r2: 0 },
    };
  }

  // Initialize level = average of first season
  const firstSeasonAvg = y.slice(0, seasonalPeriod).reduce((s, v) => s + v, 0) / seasonalPeriod;
  let level = firstSeasonAvg;

  // Initialize trend = average of first-to-second season differences
  let trend = 0;
  if (numInitSeasons >= 2) {
    const secondSeasonAvg = y.slice(seasonalPeriod, 2 * seasonalPeriod).reduce((s, v) => s + v, 0) / seasonalPeriod;
    trend = (secondSeasonAvg - firstSeasonAvg) / seasonalPeriod;
  }

  // Initialize seasonal factors (multiplicative)
  const seasonal = new Array(seasonalPeriod).fill(1);
  for (let i = 0; i < seasonalPeriod; i++) {
    let sum = 0, count = 0;
    for (let s = 0; s < numInitSeasons; s++) {
      const idx = s * seasonalPeriod + i;
      if (idx < n) {
        const seasonAvg = y.slice(s * seasonalPeriod, (s + 1) * seasonalPeriod)
          .reduce((a, b) => a + b, 0) / seasonalPeriod;
        sum += y[idx] / (seasonAvg || 1);
        count++;
      }
    }
    seasonal[i] = count > 0 ? sum / count : 1;
  }

  // Grid search for best alpha, beta, gamma on a subset
  const searchSize = Math.min(n, seasonalPeriod * 14); // ~2 weeks
  let bestAlpha = 0.3, bestBeta = 0.05, bestGamma = 0.1;
  let bestMSE = Infinity;

  const alphaVals = [0.1, 0.2, 0.3, 0.5];
  const betaVals = [0.01, 0.05, 0.1];
  const gammaVals = [0.05, 0.1, 0.2];

  for (const a of alphaVals) {
    for (const b of betaVals) {
      for (const g of gammaVals) {
        let l = level, t = trend;
        const s = [...seasonal];
        let sse = 0;

        for (let i = numInitSeasons * seasonalPeriod; i < searchSize && i < n; i++) {
          const si = i % seasonalPeriod;
          const forecast = (l + t) * s[si];
          const err = y[i] - forecast;
          sse += err * err;

          const prevL = l;
          l = a * (y[i] / (s[si] || 1)) + (1 - a) * (l + t);
          t = b * (l - prevL) + (1 - b) * t;
          s[si] = g * (y[i] / (l || 1)) + (1 - g) * s[si];
        }

        const mse = sse / (searchSize - numInitSeasons * seasonalPeriod);
        if (mse < bestMSE) {
          bestMSE = mse;
          bestAlpha = a; bestBeta = b; bestGamma = g;
        }
      }
    }
  }

  // Final training pass with best parameters
  level = firstSeasonAvg;
  trend = numInitSeasons >= 2
    ? (y.slice(seasonalPeriod, 2 * seasonalPeriod).reduce((s, v) => s + v, 0) / seasonalPeriod - firstSeasonAvg) / seasonalPeriod
    : 0;
  const finalSeasonal = [...seasonal];

  for (let i = numInitSeasons * seasonalPeriod; i < n; i++) {
    const si = i % seasonalPeriod;
    const prevL = level;
    level = bestAlpha * (y[i] / (finalSeasonal[si] || 1)) + (1 - bestAlpha) * (level + trend);
    trend = bestBeta * (level - prevL) + (1 - bestBeta) * trend;
    finalSeasonal[si] = bestGamma * (y[i] / (level || 1)) + (1 - bestGamma) * finalSeasonal[si];
  }

  return {
    type: 'holt_winters',
    alpha: bestAlpha,
    beta: bestBeta,
    gamma: bestGamma,
    seasonalPeriod,
    level,
    trend,
    seasonal: finalSeasonal.map(v => Math.round(v * 10000) / 10000),
    metrics: { rmse: 0, mape: 0, r2: 0 },
  };
}

export function predictHoltWinters(
  model: HoltWintersModel, stepsAhead: number
): number[] {
  const predictions: number[] = [];
  for (let h = 1; h <= stepsAhead; h++) {
    const si = h % model.seasonalPeriod;
    const pred = (model.level + model.trend * h) * model.seasonal[si];
    predictions.push(Math.max(3, pred));
  }
  return predictions;
}

// ─── Validation Metrics ────────────────────────────

function computeMetrics(actual: number[], predicted: number[]): ModelMetrics {
  const n = actual.length;
  let sse = 0, sae = 0, ape = 0;
  const mean = actual.reduce((s, v) => s + v, 0) / n;
  let sst = 0;

  for (let i = 0; i < n; i++) {
    const err = actual[i] - predicted[i];
    sse += err * err;
    sae += Math.abs(err);
    ape += Math.abs(err) / (actual[i] || 1);
    sst += (actual[i] - mean) ** 2;
  }

  return {
    rmse: Math.round(Math.sqrt(sse / n) * 1000) / 1000,
    mape: Math.round((ape / n) * 10000) / 100, // percentage
    r2: Math.round((1 - sse / (sst || 1)) * 10000) / 10000,
  };
}

// ─── Full Training Pipeline ────────────────────────

export function trainAllModels(
  trainData: LoadDataPoint[],
  valData: LoadDataPoint[]
): TrainedModels {
  console.log(`  Training on ${trainData.length} points, validating on ${valData.length}...`);

  // --- Model 1: Moving Average ---
  console.log('  Training Moving Average model...');
  const ma = trainMovingAverage(trainData);
  const maPreds = valData.map(p => predictMovingAverage(ma, p.hour, p.day_of_week, p.temperature));
  ma.metrics = computeMetrics(valData.map(p => p.load_mw), maPreds);
  console.log(`    MA → RMSE: ${ma.metrics.rmse}, MAPE: ${ma.metrics.mape}%, R²: ${ma.metrics.r2}`);

  // --- Model 2: Regression ---
  console.log('  Training Linear Regression model...');
  const reg = trainRegression(trainData);
  const regPreds = valData.map(p => predictRegression(reg, p));
  reg.metrics = computeMetrics(valData.map(p => p.load_mw), regPreds);
  console.log(`    Regression → RMSE: ${reg.metrics.rmse}, MAPE: ${reg.metrics.mape}%, R²: ${reg.metrics.r2}`);

  // --- Model 3: Holt-Winters ---
  console.log('  Training Holt-Winters model...');
  const hw = trainHoltWinters(trainData, 96);
  // For validation, use HW to forecast stepsAhead = valData.length
  const hwPreds = predictHoltWinters(hw, valData.length);
  hw.metrics = computeMetrics(valData.map(p => p.load_mw), hwPreds);
  console.log(`    HW → RMSE: ${hw.metrics.rmse}, MAPE: ${hw.metrics.mape}%, R²: ${hw.metrics.r2}`);

  // --- Ensemble ---
  // Weight inversely by MAPE
  const mapes = [ma.metrics.mape, reg.metrics.mape, hw.metrics.mape];
  const invMapes = mapes.map(m => 1 / (m + 0.01));
  const totalInv = invMapes.reduce((s, v) => s + v, 0);
  const weights = {
    movingAverage: Math.round((invMapes[0] / totalInv) * 1000) / 1000,
    regression: Math.round((invMapes[1] / totalInv) * 1000) / 1000,
    holtWinters: Math.round((invMapes[2] / totalInv) * 1000) / 1000,
  };

  // Compute ensemble predictions on validation
  const ensemblePreds = valData.map((p, i) => {
    return weights.movingAverage * maPreds[i]
      + weights.regression * regPreds[i]
      + weights.holtWinters * hwPreds[i];
  });
  const ensembleMetrics = computeMetrics(valData.map(p => p.load_mw), ensemblePreds);

  const ensemble: EnsembleModel = {
    type: 'ensemble',
    weights,
    metrics: ensembleMetrics,
  };
  console.log(`    Ensemble → RMSE: ${ensemble.metrics.rmse}, MAPE: ${ensemble.metrics.mape}%, R²: ${ensemble.metrics.r2}`);
  console.log(`    Weights: MA=${weights.movingAverage}, Reg=${weights.regression}, HW=${weights.holtWinters}`);

  return {
    regression: reg,
    holtWinters: hw,
    movingAverage: ma,
    ensemble,
    trainedAt: new Date().toISOString(),
  };
}

// ─── Inference (with ensemble) ─────────────────────

export function forecast(
  models: TrainedModels,
  futurePoints: Array<{
    timestamp: string;
    hour: number;
    day_of_week: number;
    month: number;
    temperature: number;
    humidity: number;
    is_holiday: boolean;
    is_weekend: boolean;
  }>,
  residualStd: number = 1.5 // typical forecast error std
): ForecastResult[] {
  const w = models.ensemble.weights;

  return futurePoints.map((p, i) => {
    const maVal = predictMovingAverage(models.movingAverage, p.hour, p.day_of_week, p.temperature);
    const regVal = predictRegression(models.regression, p as LoadDataPoint);

    // For HW, use steps-ahead from current state
    const hwSteps = predictHoltWinters(models.holtWinters, i + 1);
    const hwVal = hwSteps[hwSteps.length - 1];

    const predicted = w.movingAverage * maVal + w.regression * regVal + w.holtWinters * hwVal;

    // Confidence interval widens with forecast horizon
    const horizonFactor = 1 + (i / futurePoints.length) * 0.5;
    const sigma = residualStd * horizonFactor;

    return {
      timestamp: p.timestamp,
      predicted: Math.round(Math.max(3, predicted) * 100) / 100,
      upperBound: Math.round(Math.max(3, predicted + 2 * sigma) * 100) / 100,
      lowerBound: Math.round(Math.max(0, predicted - 2 * sigma) * 100) / 100,
    };
  });
}
