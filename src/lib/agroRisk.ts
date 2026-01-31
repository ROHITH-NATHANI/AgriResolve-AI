import type { AgroWeatherResponse } from '../services/agroWeather';

export type WetHour = {
  time: string;
  isWet: boolean;
  tempC: number;
  rh: number;
  dewPointC: number;
  precipMm: number;
  windKph: number;
};

export type DailyAgroSummary = {
  dateKey: string; // YYYY-MM-DD (local timezone per Open-Meteo)
  hours: WetHour[];
  wetHours: number;
  avgTempC: number;
  avgRh: number;
  precipMm: number;
  riskScore: number; // 0..100 (conservative, generic fungal-risk)
  drivers: string[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asFinite(n: unknown, fallback: number) {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export function estimateWetHours(weather: AgroWeatherResponse): WetHour[] {
  const h = weather.hourly;
  const out: WetHour[] = [];

  for (let i = 0; i < h.time.length; i++) {
    const time = h.time[i];
    const tempC = asFinite(h.temperature_2m[i], 0);
    const rh = asFinite(h.relative_humidity_2m[i], 0);
    const dewPointC = asFinite(h.dew_point_2m[i], tempC - 5);
    const precipMm = asFinite(h.precipitation[i], 0);
    const windKph = asFinite(h.wind_speed_10m[i], 0);

    const dewPointDep = tempC - dewPointC;
    const isWetRaw = dewPointDep <= 2.0 || rh >= 90 || precipMm >= 0.1;

    // Drying correction: windy and not raining.
    const isDrying = windKph > 12.6 && precipMm < 0.05; // ~3.5 m/s
    const isWet = isWetRaw && !isDrying;

    out.push({ time, isWet, tempC, rh, dewPointC, precipMm, windKph });
  }

  return out;
}

function dateKeyFromTimeISO(iso: string): string {
  // Open-Meteo returns local time strings when timezone=auto (e.g., 2026-02-01T13:00)
  // We use the date portion.
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : 'unknown';
}

function computeGenericFungalRisk(wetHours: number, avgTempC: number, precipMm: number): { score: number; drivers: string[] } {
  // Conservative, generic risk index:
  // - Wetness drives spore germination/infection.
  // - Moderate temps (15-26°C) increase risk.
  // - Rain adds splash dispersal.

  const drivers: string[] = [];

  const wetFactor = clamp(wetHours / 12, 0, 1); // 12+ wet hours ~= high
  if (wetHours >= 8) drivers.push(`High leaf wetness (≈${wetHours}h)`);
  else if (wetHours >= 4) drivers.push(`Moderate leaf wetness (≈${wetHours}h)`);

  const tempOpt = 21;
  const tempWidth = 7;
  const tempFactor = Math.exp(-0.5 * Math.pow((avgTempC - tempOpt) / tempWidth, 2));
  if (avgTempC >= 16 && avgTempC <= 26) drivers.push(`Favorable temperature (~${avgTempC.toFixed(0)}°C)`);

  const rainFactor = clamp(precipMm / 6, 0, 1);
  if (precipMm >= 1) drivers.push(`Rain/precipitation (~${precipMm.toFixed(1)}mm)`);

  // Combine, emphasize wetness.
  const raw = 0.60 * wetFactor + 0.30 * tempFactor + 0.10 * rainFactor;
  const score = clamp(Math.round(raw * 100), 0, 100);

  if (drivers.length === 0) drivers.push('No strong weather risk drivers detected');

  return { score, drivers };
}

export function summarizeDailyWeather(weather: AgroWeatherResponse, horizonDays: number = 5): DailyAgroSummary[] {
  const wet = estimateWetHours(weather);
  const byDay = new Map<string, WetHour[]>();

  for (const hour of wet) {
    const key = dateKeyFromTimeISO(hour.time);
    const list = byDay.get(key) ?? [];
    list.push(hour);
    byDay.set(key, list);
  }

  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, horizonDays);

  return days.map(([dateKey, hours]) => {
    const wetHours = hours.reduce((acc, h) => acc + (h.isWet ? 1 : 0), 0);
    const avgTempC = hours.reduce((acc, h) => acc + h.tempC, 0) / Math.max(1, hours.length);
    const avgRh = hours.reduce((acc, h) => acc + h.rh, 0) / Math.max(1, hours.length);
    const precipMm = hours.reduce((acc, h) => acc + h.precipMm, 0);

    const { score, drivers } = computeGenericFungalRisk(wetHours, avgTempC, precipMm);

    return {
      dateKey,
      hours,
      wetHours,
      avgTempC,
      avgRh,
      precipMm,
      riskScore: score,
      drivers,
    };
  });
}
