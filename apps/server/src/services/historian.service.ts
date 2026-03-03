import { prisma } from '../config/database';
import type { TrendQuery, TrendData, TrendResolution } from '@gridvision/shared';

/** A single sample in the ring buffer. */
interface RingSample {
  tag: string;
  value: number;
  quality: number;
  timestamp: Date;
}

/** Statistics result for a tag over a time range. */
export interface TagStatistics {
  tag: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  stddev: number;
  first: Date | null;
  last: Date | null;
}

/**
 * Enhanced historian service with in-memory ring buffer for fast recent queries
 * and PostgreSQL for long-term storage.
 */
export class HistorianService {
  // In-memory ring buffer — last 1 hour of data per tag
  private ringBuffer: Map<string, RingSample[]> = new Map();
  private readonly RING_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
  private readonly RING_MAX_SAMPLES = 3600;

  // Latest values cache for instant /latest queries
  private latestValues: Map<string, RingSample> = new Map();

  // ─────────────────── Recording ───────────────────

  async recordMeasurement(dataPointId: string, value: number, quality: number = 0): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO measurements (time, data_point_id, value, quality) VALUES (NOW(), $1::uuid, $2, $3)`,
        dataPointId,
        value,
        quality,
      );
    } catch (err: any) {
      console.warn("[Historian] operation failed:", err.message);
    }
  }

  /** Record to the in-memory ring buffer (called for every simulator tick). */
  recordToRingBuffer(tag: string, value: number, quality: number = 0): void {
    const sample: RingSample = { tag, value, quality, timestamp: new Date() };
    this.latestValues.set(tag, sample);

    let ring = this.ringBuffer.get(tag);
    if (!ring) {
      ring = [];
      this.ringBuffer.set(tag, ring);
    }
    ring.push(sample);

    // Trim by max samples
    if (ring.length > this.RING_MAX_SAMPLES) {
      ring.splice(0, ring.length - this.RING_MAX_SAMPLES);
    }
    // Trim by max age
    const cutoff = Date.now() - this.RING_MAX_AGE_MS;
    while (ring.length > 0 && ring[0].timestamp.getTime() < cutoff) {
      ring.shift();
    }
  }

  async recordDigitalState(dataPointId: string, state: boolean, quality: number = 0): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO digital_states (time, data_point_id, state, quality) VALUES (NOW(), $1::uuid, $2, $3)`,
        dataPointId,
        state,
        quality,
      );
    } catch (err: any) {
      console.warn("[Historian] operation failed:", err.message);
    }
  }

  async recordSOEEvent(dataPointId: string, oldState: string, newState: string, cause?: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO soe_events (time, data_point_id, old_state, new_state, cause) VALUES (NOW(), $1::uuid, $2, $3, $4)`,
        dataPointId,
        oldState,
        newState,
        cause || null,
      );
    } catch (err: any) {
      console.warn("[Historian] operation failed:", err.message);
    }
  }

  // ─────────────────── Ring buffer queries ───────────────────

  /** Get latest values for a set of tags (instant from memory). */
  getLatestValues(tags: string[]): Record<string, RingSample | undefined> {
    const result: Record<string, RingSample | undefined> = {};
    for (const tag of tags) {
      result[tag] = this.latestValues.get(tag);
    }
    return result;
  }

  /** Get all latest values. */
  getAllLatestValues(): Record<string, RingSample> {
    return Object.fromEntries(this.latestValues);
  }

  /**
   * Query ring buffer for tags within a time range.
   * Optionally downsample to a given interval in ms.
   */
  queryRingBuffer(
    tags: string[],
    fromMs: number,
    toMs: number,
    intervalMs?: number,
  ): Record<string, Array<{ time: number; value: number }>> {
    const result: Record<string, Array<{ time: number; value: number }>> = {};

    for (const tag of tags) {
      const ring = this.ringBuffer.get(tag);
      if (!ring) {
        result[tag] = [];
        continue;
      }

      const filtered = ring.filter((s) => {
        const t = s.timestamp.getTime();
        return t >= fromMs && t <= toMs;
      });

      if (!intervalMs || intervalMs <= 0) {
        result[tag] = filtered.map((s) => ({ time: s.timestamp.getTime(), value: s.value }));
        continue;
      }

      // Downsample by averaging within buckets
      const buckets: Map<number, { sum: number; count: number }> = new Map();
      for (const s of filtered) {
        const bucket = Math.floor(s.timestamp.getTime() / intervalMs) * intervalMs;
        const existing = buckets.get(bucket);
        if (existing) {
          existing.sum += s.value;
          existing.count++;
        } else {
          buckets.set(bucket, { sum: s.value, count: 1 });
        }
      }
      const downsampled: Array<{ time: number; value: number }> = [];
      for (const [bucket, agg] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
        downsampled.push({ time: bucket, value: agg.sum / agg.count });
      }
      result[tag] = downsampled;
    }

    return result;
  }

  /** Compute statistics for a tag over a time range from ring buffer. */
  computeStatistics(tag: string, fromMs: number, toMs: number): TagStatistics {
    const ring = this.ringBuffer.get(tag) ?? [];
    const filtered = ring.filter((s) => {
      const t = s.timestamp.getTime();
      return t >= fromMs && t <= toMs;
    });

    if (filtered.length === 0) {
      return { tag, count: 0, min: 0, max: 0, avg: 0, stddev: 0, first: null, last: null };
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const s of filtered) {
      if (s.value < min) min = s.value;
      if (s.value > max) max = s.value;
      sum += s.value;
    }
    const avg = sum / filtered.length;

    let varianceSum = 0;
    for (const s of filtered) {
      varianceSum += (s.value - avg) ** 2;
    }
    const stddev = Math.sqrt(varianceSum / filtered.length);

    return {
      tag,
      count: filtered.length,
      min,
      max,
      avg,
      stddev,
      first: filtered[0].timestamp,
      last: filtered[filtered.length - 1].timestamp,
    };
  }

  // ─────────────────── DB trend queries (existing) ───────────────────

  async queryTrend(query: TrendQuery): Promise<TrendData[]> {
    const resolution = query.resolution || this.autoResolution(query.startTime, query.endTime);
    const results: TrendData[] = [];

    for (const dpId of query.dataPointIds) {
      const dataPoint = await prisma.dataPoint.findUnique({
        where: { id: dpId },
        select: { tag: true, unit: true },
      });

      if (!dataPoint) continue;

      let points: Array<{ bucket: Date; avg_value: number; min_value: number; max_value: number }>;

      if (resolution === 'raw') {
        const raw = await prisma.$queryRawUnsafe<Array<{ time: Date; value: number }>>(
          `SELECT time, value FROM measurements WHERE data_point_id = $1::uuid AND time >= $2 AND time <= $3 ORDER BY time`,
          dpId,
          query.startTime,
          query.endTime,
        );
        points = raw.map((r) => ({
          bucket: r.time,
          avg_value: r.value,
          min_value: r.value,
          max_value: r.value,
        }));
      } else {
        const bucket = resolution === '1min' ? '1 minute' : resolution === '5min' ? '5 minutes' : '1 hour';
        points = await prisma.$queryRawUnsafe<Array<{ bucket: Date; avg_value: number; min_value: number; max_value: number }>>(
          `SELECT time_bucket($1::interval, time) AS bucket,
                  AVG(value) AS avg_value,
                  MIN(value) AS min_value,
                  MAX(value) AS max_value
           FROM measurements
           WHERE data_point_id = $2::uuid AND time >= $3 AND time <= $4
           GROUP BY bucket
           ORDER BY bucket`,
          bucket,
          dpId,
          query.startTime,
          query.endTime,
        );
      }

      results.push({
        dataPointId: dpId,
        tag: dataPoint.tag,
        unit: dataPoint.unit || undefined,
        points: points.map((p) => ({
          time: p.bucket,
          avg: Number(p.avg_value),
          min: Number(p.min_value),
          max: Number(p.max_value),
        })),
      });
    }

    return results;
  }

  async getSOEEvents(startTime: Date, endTime: Date, substationId?: string, limit = 500) {
    let query = `
      SELECT s.time, s.old_state, s.new_state, s.cause,
             dp.tag, dp.name as dp_name, e.name as equip_name
      FROM soe_events s
      JOIN data_points dp ON s.data_point_id = dp.id
      JOIN equipment e ON dp.equipment_id = e.id
      JOIN bays b ON e.bay_id = b.id
      JOIN voltage_levels vl ON b.voltage_level_id = vl.id
      WHERE s.time >= $1 AND s.time <= $2
    `;
    const params: unknown[] = [startTime, endTime];

    if (substationId) {
      query += ` AND vl.substation_id = $3::uuid`;
      params.push(substationId);
    }

    query += ` ORDER BY s.time DESC LIMIT ${limit}`;

    return prisma.$queryRawUnsafe(query, ...params);
  }

  private autoResolution(start: Date, end: Date): TrendResolution {
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 1) return 'raw';
    if (diffHours <= 24) return '1min';
    if (diffHours <= 168) return '5min';
    return '1hour';
  }
}

export const historianService = new HistorianService();
