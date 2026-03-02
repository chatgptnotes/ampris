/**
 * Synthetic Load Data Generator
 * Generates realistic 33kV substation load data correlated with actual Nagpur weather.
 * Produces 15-minute interval data (~35,040 points per year).
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────

interface WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    cloud_cover: number[];
  };
}

export interface LoadDataPoint {
  timestamp: string;        // ISO string
  load_mw: number;          // MW
  temperature: number;      // °C
  humidity: number;         // %
  wind_speed: number;       // km/h
  cloud_cover: number;      // %
  hour: number;
  day_of_week: number;      // 0=Sun
  month: number;            // 1-12
  is_weekend: boolean;
  is_holiday: boolean;
}

// ─── Indian Holidays (approximate dates) ────────────

const HOLIDAYS: Record<number, string[]> = {
  2024: [
    '2024-01-26', // Republic Day
    '2024-03-25', // Holi
    '2024-03-29', // Good Friday
    '2024-04-11', // Eid ul-Fitr (approx)
    '2024-04-14', // Ambedkar Jayanti
    '2024-04-17', // Ram Navami
    '2024-04-21', // Mahavir Jayanti
    '2024-05-23', // Buddha Purnima
    '2024-06-17', // Eid ul-Adha (approx)
    '2024-07-17', // Muharram (approx)
    '2024-08-15', // Independence Day
    '2024-08-26', // Janmashtami
    '2024-09-07', // Ganesh Chaturthi (start)
    '2024-09-08',
    '2024-09-09',
    '2024-09-10',
    '2024-09-17', // Ganesh Visarjan
    '2024-09-16', // Milad un-Nabi (approx)
    '2024-10-02', // Gandhi Jayanti
    '2024-10-12', // Dussehra
    '2024-10-31', // Halloween / Diwali day 1
    '2024-11-01', // Diwali
    '2024-11-02', // Diwali day 3
    '2024-11-03', // Bhai Dooj
    '2024-11-15', // Guru Nanak Jayanti
    '2024-12-25', // Christmas
  ],
  2025: [
    '2025-01-26', // Republic Day
    '2025-03-14', // Holi
    '2025-03-30', // Eid ul-Fitr (approx)
    '2025-04-14', // Ambedkar Jayanti
    '2025-04-06', // Ram Navami
    '2025-04-10', // Mahavir Jayanti
    '2025-04-18', // Good Friday
    '2025-05-12', // Buddha Purnima
    '2025-06-07', // Eid ul-Adha (approx)
    '2025-07-06', // Muharram (approx)
    '2025-08-15', // Independence Day
    '2025-08-16', // Janmashtami
    '2025-08-27', // Ganesh Chaturthi (start)
    '2025-08-28',
    '2025-08-29',
    '2025-09-05', // Ganesh Visarjan
    '2025-09-05', // Milad un-Nabi (approx)
    '2025-10-02', // Gandhi Jayanti / Dussehra
    '2025-10-20', // Diwali
    '2025-10-21',
    '2025-10-22',
    '2025-10-23', // Bhai Dooj
    '2025-11-05', // Guru Nanak Jayanti
    '2025-12-25', // Christmas
  ],
};

// Festival spike days (Diwali, Ganesh Chaturthi — high lighting/decorative load)
const FESTIVAL_SPIKE_DATES: Record<number, string[]> = {
  2024: ['2024-09-07', '2024-10-31', '2024-11-01', '2024-11-02'],
  2025: ['2025-08-27', '2025-10-20', '2025-10-21', '2025-10-22'],
};

// ─── Base Load Profile (MW) ────────────────────────

// Hourly base load for a 33kV substation (~20MW peak)
const HOURLY_BASE: number[] = [
  // 00:00-05:00: Night (low)
  9.0, 8.5, 8.2, 8.0, 8.3, 9.0,
  // 06:00-11:00: Morning ramp
  11.0, 13.0, 15.0, 17.0, 18.0, 18.5,
  // 12:00-17:00: Day peak
  19.0, 19.5, 20.0, 19.5, 18.5, 17.5,
  // 18:00-23:00: Evening peak then decline
  19.0, 21.0, 22.0, 20.0, 16.0, 12.0,
];

// ─── Seeded PRNG ───────────────────────────────────

class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }
  /** Gaussian random via Box-Muller */
  gaussian(mean: number = 0, std: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

// ─── Generator ─────────────────────────────────────

function loadWeather(year: number): WeatherData {
  const filePath = path.join(__dirname, '../../data', `weather_nagpur_${year}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getWeatherAtTime(weather: WeatherData, targetIso: string): {
  temperature: number; humidity: number; wind_speed: number; cloud_cover: number;
} {
  // Weather data is hourly. Find the closest hour.
  const targetDate = new Date(targetIso);
  const targetHour = new Date(
    targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), targetDate.getHours()
  );
  const targetStr = `${targetHour.getFullYear()}-${String(targetHour.getMonth() + 1).padStart(2, '0')}-${String(targetHour.getDate()).padStart(2, '0')}T${String(targetHour.getHours()).padStart(2, '0')}:00`;

  let idx = weather.hourly.time.indexOf(targetStr);
  if (idx === -1) {
    // Fallback: find nearest
    idx = Math.min(weather.hourly.time.length - 1, Math.max(0,
      Math.floor((targetDate.getTime() - new Date(weather.hourly.time[0]).getTime()) / 3600000)
    ));
  }

  return {
    temperature: weather.hourly.temperature_2m[idx] ?? 30,
    humidity: weather.hourly.relative_humidity_2m[idx] ?? 60,
    wind_speed: weather.hourly.wind_speed_10m[idx] ?? 5,
    cloud_cover: weather.hourly.cloud_cover[idx] ?? 50,
  };
}

function isHoliday(dateStr: string, year: number): boolean {
  return (HOLIDAYS[year] || []).includes(dateStr);
}

function isFestivalSpike(dateStr: string, year: number): boolean {
  return (FESTIVAL_SPIKE_DATES[year] || []).includes(dateStr);
}

export function generateLoadData(year: number): LoadDataPoint[] {
  const weather = loadWeather(year);
  const rng = new SeededRandom(year * 31337);
  const data: LoadDataPoint[] = [];

  const startDate = new Date(year, 0, 1, 0, 0, 0);
  const endDate = new Date(year, 11, 31, 23, 45, 0);

  // Pre-generate load shedding events (random 2-4 hour dips)
  const sheddingEvents: { start: number; end: number }[] = [];
  const numShedding = Math.floor(rng.next() * 15) + 10; // 10-24 events per year
  for (let i = 0; i < numShedding; i++) {
    const dayOffset = Math.floor(rng.next() * 365);
    const hourStart = Math.floor(rng.next() * 18) + 3; // 3am-9pm
    const duration = Math.floor(rng.next() * 3) + 2; // 2-4 hours
    const start = new Date(year, 0, 1 + dayOffset, hourStart).getTime();
    const end = start + duration * 3600000;
    sheddingEvents.push({ start, end });
  }

  for (let t = startDate.getTime(); t <= endDate.getTime(); t += 15 * 60 * 1000) {
    const dt = new Date(t);
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    const dayOfWeek = dt.getDay();
    const month = dt.getMonth() + 1; // 1-12
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    // Get weather for this time
    const w = getWeatherAtTime(weather, dt.toISOString());

    // 1. Base hourly load (interpolated for 15-min intervals)
    const hourFrac = hour + minute / 60;
    const idx = Math.floor(hourFrac);
    const nextIdx = (idx + 1) % 24;
    const frac = hourFrac - idx;
    let load = HOURLY_BASE[idx] * (1 - frac) + HOURLY_BASE[nextIdx] * frac;

    // 2. Seasonal variation based on temperature
    // Above 30°C: each degree adds ~0.8% (AC load)
    // Below 20°C: each degree below reduces ~0.3%
    if (w.temperature > 30) {
      load *= 1 + (w.temperature - 30) * 0.008;
    } else if (w.temperature > 40) {
      // Extreme heat — exponential AC demand
      load *= 1 + (30 - 30) * 0.008 + (w.temperature - 40) * 0.015;
    }
    if (w.temperature < 20) {
      load *= 1 - (20 - w.temperature) * 0.003;
    }

    // Seasonal base adjustment
    if (month >= 3 && month <= 6) {
      // Summer: +15-35% base increase
      const summerPeak = month === 5 ? 0.35 : (month === 4 || month === 6) ? 0.25 : 0.15;
      load *= 1 + summerPeak;
    } else if (month >= 7 && month <= 9) {
      // Monsoon: -5-10%
      load *= 0.92;
    } else {
      // Winter: -10-15%
      load *= 0.87;
    }

    // Humidity effect (high humidity + high temp = more AC)
    if (w.humidity > 70 && w.temperature > 28) {
      load *= 1 + (w.humidity - 70) * 0.001;
    }

    // 3. Weekly pattern
    if (dayOfWeek === 0) {
      load *= 0.80; // Sunday -20%
    } else if (dayOfWeek === 6) {
      load *= 0.90; // Saturday -10%
    }

    // 4. Holiday effect
    const holiday = isHoliday(dateStr, year);
    if (holiday) {
      load *= 0.75; // -25%
    }

    // 5. Festival spike (Diwali lighting, etc.) — evening hours only
    if (isFestivalSpike(dateStr, year) && hour >= 18 && hour <= 23) {
      load *= 1.15; // +15% decorative lighting
    }

    // 6. Load shedding
    const isShedding = sheddingEvents.some(e => t >= e.start && t < e.end);
    if (isShedding) {
      load *= 0.3 + rng.next() * 0.2; // Drop to 30-50% of normal
    }

    // 7. Random noise ±3-5%
    const noise = rng.gaussian(0, 0.04);
    load *= (1 + noise);

    // Clamp to realistic range
    load = Math.max(3, Math.min(30, load));

    data.push({
      timestamp: dt.toISOString(),
      load_mw: Math.round(load * 100) / 100,
      temperature: w.temperature,
      humidity: w.humidity,
      wind_speed: w.wind_speed,
      cloud_cover: w.cloud_cover,
      hour,
      day_of_week: dayOfWeek,
      month,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      is_holiday: holiday,
    });
  }

  return data;
}

// ─── CLI Entry ─────────────────────────────────────

if (require.main === module) {
  const dataDir = path.join(__dirname, '../../data');

  console.log('Generating load data for 2024...');
  const data2024 = generateLoadData(2024);
  fs.writeFileSync(path.join(dataDir, 'load_data_2024.json'), JSON.stringify(data2024));
  console.log(`  2024: ${data2024.length} data points`);

  console.log('Generating load data for 2025...');
  const data2025 = generateLoadData(2025);
  fs.writeFileSync(path.join(dataDir, 'load_data_2025.json'), JSON.stringify(data2025));
  console.log(`  2025: ${data2025.length} data points`);

  console.log('Done.');
}
