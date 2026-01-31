import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AssessmentData } from '../types';
import { useTranslation } from 'react-i18next';
import { AlertCircle, HelpCircle, Scan, Leaf, FileText } from 'lucide-react';
import { computeLeafCrops, LeafCrop } from '../lib/leafCrops';
import { buildComplianceSummaryText, findRestrictedChemicals } from '../lib/regulatory';
import { generateTimeTravelPreview } from '../lib/timeTravel';
import { fetchAgroWeather } from '../services/agroWeather';
import { summarizeDailyWeather, type DailyAgroSummary } from '../lib/agroRisk';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number) {
  return clamp(n, 0, 1);
}

function expandBBox(
  bbox: { x: number; y: number; w: number; h: number },
  factor: number,
  maxW: number,
  maxH: number
) {
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const w = bbox.w * factor;
  const h = bbox.h * factor;
  const x = clamp(Math.round(cx - w / 2), 0, Math.max(0, maxW - 1));
  const y = clamp(Math.round(cy - h / 2), 0, Math.max(0, maxH - 1));
  const x2 = clamp(Math.round(cx + w / 2), 0, maxW);
  const y2 = clamp(Math.round(cy + h / 2), 0, maxH);
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

function iou(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function cropToDataUrl(img: HTMLImageElement, bbox: { x: number; y: number; w: number; h: number }) {
  const maxThumbW = 320;
  const thumbScale = Math.min(1, maxThumbW / bbox.w);
  const outW = Math.max(1, Math.round(bbox.w * thumbScale));
  const outH = Math.max(1, Math.round(bbox.h * thumbScale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function buildFallbackBBoxes(params: {
  leafCount: number;
  srcW: number;
  srcH: number;
  existing: Array<{ x: number; y: number; w: number; h: number }>;
  attentionBoxes?: Array<{ x?: number; y?: number; w?: number; h?: number }>;
}) {
  const { leafCount, srcW, srcH, existing, attentionBoxes } = params;

  const candidates: Array<{ x: number; y: number; w: number; h: number }> = [];

  const existingExpanded = existing.map((b) => expandBBox(b, 1.0, srcW, srcH));

  const pushCandidate = (bbox: { x: number; y: number; w: number; h: number }) => {
    const expanded = expandBBox(bbox, 1.12, srcW, srcH);
    // Never allow "fallback" to become a massive box that looks broken.
    const areaRatio = (expanded.w * expanded.h) / Math.max(1, srcW * srcH);
    if (areaRatio > 0.72) return;
    if (existingExpanded.some((e) => iou(e, expanded) > 0.6)) return;
    if (candidates.some((c) => iou(c, expanded) > 0.6)) return;
    candidates.push(expanded);
  };

  // 1) Prefer model attention boxes if present (best effort)
  if (Array.isArray(attentionBoxes)) {
    for (const b of attentionBoxes.slice(0, 6)) {
      const x = clamp01(b.x ?? 0) * srcW;
      const y = clamp01(b.y ?? 0) * srcH;
      const w = clamp01(b.w ?? 0) * srcW;
      const h = clamp01(b.h ?? 0) * srcH;
      if (w < 8 || h < 8) continue;
      pushCandidate({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      if (existingExpanded.length + candidates.length >= leafCount) break;
    }
  }

  // 2) If still missing, fall back to simple vertical partitions of the image.
  const neededAfterAttn = leafCount - (existingExpanded.length + candidates.length);
  if (neededAfterAttn > 0) {
    for (let i = 0; i < leafCount && existingExpanded.length + candidates.length < leafCount; i++) {
      const partX1 = Math.round((i / leafCount) * srcW);
      const partX2 = Math.round(((i + 1) / leafCount) * srcW);
      const partW = Math.max(1, partX2 - partX1);
      const mx = Math.round(partW * 0.06);
      const my = Math.round(srcH * 0.06);
      const bbox = {
        x: clamp(partX1 + mx, 0, srcW - 1),
        y: my,
        w: Math.max(1, partW - mx * 2),
        h: Math.max(1, srcH - my * 2),
      };
      pushCandidate(bbox);
    }
  }

  return candidates;
}

interface FinalResultsProps {
  data: AssessmentData;
  sourceImage?: string | null;
  isDemoMode?: boolean;
}

type StoredCoords = { latitude: number; longitude: number; accuracy?: number; timestamp: number };
type StoredConsent = 'unknown' | 'granted' | 'denied';

const LS_CONSENT = 'agriresolve_location_consent_v3';
const LS_COORDS = 'agriresolve_location_coords_v3';
const LS_AGRO = 'agriresolve_agro_weather_cache_v1';

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const FinalResults: React.FC<FinalResultsProps> = ({ data, sourceImage, isDemoMode }) => {
  const { t } = useTranslation();

  const [timeTravel, setTimeTravel] = useState<number>(0); // 0..100
  const [futurePreview, setFuturePreview] = useState<string | null>(null);
  const [isGeneratingFuture, setIsGeneratingFuture] = useState<boolean>(false);
  const [forecastSummaries, setForecastSummaries] = useState<DailyAgroSummary[] | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastMode, setForecastMode] = useState<'live' | 'demo' | 'unavailable'>('unavailable');

  const complianceHits = useMemo(() => {
    const text = [
      data?.explanation?.summary,
      ...(data?.explanation?.guidance ?? []),
      ...(data?.arbitrationResult?.rationale ?? []),
      ...(data?.healthyResult?.arguments ?? []),
      ...(data?.diseaseResult?.arguments ?? []),
    ]
      .filter(Boolean)
      .join('\n');

    return findRestrictedChemicals(text);
  }, [
    data?.explanation?.summary,
    data?.explanation?.guidance,
    data?.arbitrationResult?.rationale,
    data?.healthyResult?.arguments,
    data?.diseaseResult?.arguments,
  ]);

  const complianceSummary = useMemo(() => buildComplianceSummaryText(complianceHits), [complianceHits]);

  const [leafCrops, setLeafCrops] = useState<LeafCrop[]>([]);
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number } | null>(null);
  const [selectedLeafId, setSelectedLeafId] = useState<string | null>(null);

  const leafCount = useMemo(() => {
    const n = data.leafAssessments?.length || 0;
    return Math.min(3, Math.max(0, n));
  }, [data.leafAssessments?.length]);

  const orderedLeafIds = useMemo(() => {
    const ids = (data.leafAssessments ?? []).map((l) => l.id).filter(Boolean);
    // Sort Leaf A, Leaf B, Leaf C left-to-right by ID (stable for our UI)
    return ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data.leafAssessments]);

  const aiLeafRegionsById = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; h: number; confidence?: number }>();
    const regions = data?.visionEvidence?.leaf_regions ?? [];
    if (!Array.isArray(regions)) return map;

    for (const r of regions) {
      if (!r?.id) continue;
      if (![r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
      if (r.w <= 0 || r.h <= 0) continue;
      map.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h, confidence: r.confidence });
    }
    return map;
  }, [data?.visionEvidence?.leaf_regions]);

  const leafCropById = useMemo(() => {
    const map = new Map<string, LeafCrop>();
    if (!orderedLeafIds.length || !leafCrops.length) return map;

    const crops = [...leafCrops].sort((a, b) => a.bbox.x - b.bbox.x);
    for (let i = 0; i < orderedLeafIds.length && i < crops.length; i++) {
      map.set(orderedLeafIds[i], crops[i]);
    }
    return map;
  }, [leafCrops, orderedLeafIds]);

  const dayIndex = useMemo(() => {
    if (!forecastSummaries || forecastSummaries.length === 0) return 0;
    const maxIndex = Math.max(0, forecastSummaries.length - 1);
    return Math.min(maxIndex, Math.round((timeTravel / 100) * maxIndex));
  }, [timeTravel, forecastSummaries]);

  const activeForecast = useMemo(() => {
    if (!forecastSummaries || forecastSummaries.length === 0) return null;
    return forecastSummaries[dayIndex] ?? forecastSummaries[0];
  }, [forecastSummaries, dayIndex]);

  useEffect(() => {
    let cancelled = false;

    const buildDemoForecast = (): DailyAgroSummary[] => {
      const today = new Date();
      const out: DailyAgroSummary[] = [];
      for (let i = 0; i < 5; i++) {
        const dt = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = dt.toISOString().slice(0, 10);
        const wetHours = i <= 1 ? 9 : i === 2 ? 12 : 6;
        const avgTempC = i <= 2 ? 22 + i : 19 + i * 0.6;
        const precipMm = i === 1 ? 4.2 : i === 2 ? 1.3 : 0.2;
        const riskScore = i <= 1 ? 78 : i === 2 ? 65 : 42;
        const drivers = [
          wetHours >= 8 ? `High leaf wetness (≈${wetHours}h)` : `Moderate leaf wetness (≈${wetHours}h)`,
          `Favorable temperature (~${avgTempC.toFixed(0)}°C)`,
          precipMm >= 1 ? `Rain/precipitation (~${precipMm.toFixed(1)}mm)` : 'Low precipitation',
        ];

        out.push({
          dateKey,
          hours: [],
          wetHours,
          avgTempC,
          avgRh: 84,
          precipMm,
          riskScore,
          drivers,
        });
      }
      return out;
    };

    const load = async () => {
      setForecastError(null);

      if (isDemoMode) {
        if (!cancelled) {
          setForecastSummaries(buildDemoForecast());
          setForecastMode('demo');
        }
        return;
      }

      const consent = typeof window !== 'undefined' ? (window.localStorage.getItem(LS_CONSENT) as StoredConsent | null) : null;
      const coords = typeof window !== 'undefined' ? safeParse<StoredCoords>(window.localStorage.getItem(LS_COORDS)) : null;
      if (consent !== 'granted' || !coords) {
        if (!cancelled) {
          setForecastSummaries(null);
          setForecastMode('unavailable');
        }
        return;
      }

      const cached = typeof window !== 'undefined' ? safeParse<{ fetchedAt: number; summaries: DailyAgroSummary[] }>(window.localStorage.getItem(LS_AGRO)) : null;
      const now = Date.now();
      const CACHE_MS = 2 * 60 * 60 * 1000; // 2 hours
      if (cached?.fetchedAt && now - cached.fetchedAt < CACHE_MS) {
        if (!cancelled) {
          setForecastSummaries(cached.summaries);
          setForecastMode('live');
        }
        return;
      }

      const weather = await fetchAgroWeather(coords.latitude, coords.longitude, { pastDays: 7, forecastDays: 5 });
      if (!weather) {
        if (!cancelled) {
          setForecastSummaries(null);
          setForecastMode('unavailable');
          setForecastError('Forecast unavailable');
        }
        return;
      }

      const summaries = summarizeDailyWeather(weather, 5);
      if (!cancelled) {
        setForecastSummaries(summaries);
        setForecastMode('live');
        try {
          window.localStorage.setItem(LS_AGRO, JSON.stringify({ fetchedAt: now, summaries }));
        } catch {
          // ignore
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!sourceImage || !leafCount) {
        setLeafCrops([]);
        setSourceDims(null);
        return;
      }

      try {
        // Read natural dimensions so we can map crop bounding boxes onto the displayed image.
        const img = new Image();
        img.decoding = 'async';
        img.src = sourceImage;
        await img.decode();
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!cancelled && w && h) setSourceDims({ w, h });

        // 1) Preferred: use AI-provided per-leaf regions (so borders match what the AI is describing)
        const aiRegions = data?.visionEvidence?.leaf_regions ?? [];

        if (w && h && Array.isArray(aiRegions) && aiRegions.length > 0) {
          const cropsFromAI = aiRegions
            .filter((r) => r && typeof r.id === 'string' && r.id.length > 0)
            .map((r) => {
              const bbox = {
                x: Math.round(clamp01(r.x) * w),
                y: Math.round(clamp01(r.y) * h),
                w: Math.max(1, Math.round(clamp01(r.w) * w)),
                h: Math.max(1, Math.round(clamp01(r.h) * h)),
              };
              const expanded = expandBBox(bbox, 1.05, w, h);
              return { id: r.id, crop: { bbox: expanded, dataUrl: cropToDataUrl(img, expanded) } };
            })
            .filter((x) => Boolean(x.crop.dataUrl));

          // Align crops to Leaf A/Leaf B order
          const byId = new Map<string, LeafCrop>();
          for (const item of cropsFromAI) byId.set(item.id, item.crop);
          const ordered = orderedLeafIds
            .map((id) => byId.get(id))
            .filter(Boolean) as LeafCrop[];

          if (!cancelled && ordered.length > 0) {
            setLeafCrops(ordered);
            return;
          }
        }

        // 2) Fallback: client-side segmentation (best effort)
        const crops = await computeLeafCrops(sourceImage, leafCount);

        let finalCrops = crops;
        if (w && h && crops.length < leafCount) {
          const existing = crops.map((c) => c.bbox);
          const fallbacks = buildFallbackBBoxes({
            leafCount,
            srcW: w,
            srcH: h,
            existing,
            attentionBoxes: data?.visionEvidence?.attention_boxes,
          });

          const missing = Math.max(0, leafCount - crops.length);
          const picked = fallbacks
            .sort((a, b) => a.x - b.x)
            .slice(0, missing)
            .map((bbox) => ({
              bbox,
              dataUrl: cropToDataUrl(img, bbox),
            }));

          finalCrops = [...crops, ...picked]
            .sort((a, b) => a.bbox.x - b.bbox.x)
            .slice(0, leafCount);
        }

        if (!cancelled) setLeafCrops(finalCrops);
      } catch {
        if (!cancelled) setLeafCrops([]);
        if (!cancelled) setSourceDims(null);
        if (!cancelled) setFuturePreview(null);
        if (!cancelled) setIsGeneratingFuture(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sourceImage, leafCount, data?.visionEvidence?.leaf_regions, orderedLeafIds]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!sourceImage) {
        setFuturePreview(null);
        return;
      }

      setIsGeneratingFuture(true);
      try {
        const preview = await generateTimeTravelPreview(sourceImage, data?.visionEvidence?.attention_boxes, {
          riskScore: activeForecast?.riskScore,
          wetHours: activeForecast?.wetHours,
          dayAhead: dayIndex,
        });
        if (!cancelled) setFuturePreview(preview);
      } catch {
        if (!cancelled) setFuturePreview(null);
      } finally {
        if (!cancelled) setIsGeneratingFuture(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sourceImage, data?.visionEvidence?.attention_boxes, activeForecast?.riskScore, activeForecast?.wetHours, dayIndex]);

  // Keep selection valid when new results arrive
  useEffect(() => {
    const ids = (data.leafAssessments ?? []).map((l) => l.id).filter(Boolean);
    if (ids.length === 0) {
      setSelectedLeafId(null);
      return;
    }
    setSelectedLeafId((prev) => (prev && ids.includes(prev) ? prev : ids[0]));
  }, [data.leafAssessments]);

  const formatConfidence = (value?: number) => {
    const num = typeof value === 'number' ? value : 0;
    const clamped = Math.max(0, Math.min(1, num));
    return `${Math.round(clamped * 100)}%`;
  };

  const riskBadge = useMemo(() => {
    if (!activeForecast) return null;
    const score = activeForecast.riskScore;
    if (score >= 70) return { label: 'Higher likelihood', className: 'bg-red-50 text-red-700 border-red-200' };
    if (score >= 45) return { label: 'Moderate likelihood', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Lower likelihood', className: 'bg-green-50 text-green-700 border-green-200' };
  }, [activeForecast]);

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case 'Likely Healthy': return 'bg-green-100 text-green-700 border-green-200';
      case 'Possibly Healthy': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Possibly Abnormal': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Likely Abnormal': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const verdictLabel = useMemo(() => {
    const verdict = data.arbitrationResult?.decision;
    if (!verdict) return '';
    if (verdict === 'Conservative Decision') {
      return t('conservative_decision', { defaultValue: verdict });
    }
    if (verdict === 'Not a Leaf') {
      return t('not_a_leaf', { defaultValue: verdict });
    }
    if (verdict === 'Unknown') {
      return t('unknown_issue', { defaultValue: verdict });
    }
    return verdict;
  }, [data.arbitrationResult?.decision, t]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">

      {/* 1. Image Overview & Quality */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl overflow-hidden relative">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <Scan className="w-6 h-6 text-blue-600" />
          {t('image_overview', { defaultValue: 'Image Overview' })}
        </h2>

        {sourceImage && sourceDims && leafCrops.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">
              {t('source_image', { defaultValue: 'Source Image' })}
            </div>
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
              <img src={sourceImage} alt={t('source_image', { defaultValue: 'Source Image' })} className="w-full h-full object-cover" />

              {/* Time-travel overlay (future preview) */}
              {futurePreview && (
                <img
                  src={futurePreview}
                  alt={t('time_travel_future', { defaultValue: 'Simulated future preview' })}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{
                    clipPath: `inset(0 ${Math.max(0, 100 - timeTravel)}% 0 0)`,
                    filter: 'saturate(1.05) contrast(1.02)',
                    opacity: 0.95,
                  }}
                />
              )}

              {/* Slider divider line */}
              {futurePreview && timeTravel > 0 && timeTravel < 100 && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.25)] pointer-events-none"
                  style={{ left: `${timeTravel}%` }}
                />
              )}

              {/* Attention heatmap (best effort) */}
              {Array.isArray(data.visionEvidence?.attention_boxes) && data.visionEvidence.attention_boxes.length > 0 && (
                <>
                  {data.visionEvidence.attention_boxes.slice(0, 5).map((box, idx) => {
                    const leftPct = Math.max(0, Math.min(100, (box.x ?? 0) * 100));
                    const topPct = Math.max(0, Math.min(100, (box.y ?? 0) * 100));
                    const widthPct = Math.max(0, Math.min(100, (box.w ?? 0) * 100));
                    const heightPct = Math.max(0, Math.min(100, (box.h ?? 0) * 100));

                    return (
                      <div
                        key={`attn-${idx}`}
                        className="absolute rounded-xl pointer-events-none"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                          background:
                            'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.35) 0%, rgba(239,68,68,0.16) 45%, rgba(239,68,68,0.0) 72%)',
                          border: '1px solid rgba(239,68,68,0.35)',
                        }}
                      />
                    );
                  })}

                  <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-[10px] font-bold bg-black/70 text-white border border-white/20">
                    {t('attention_heatmap', { defaultValue: 'AI attention (approx.)' })}
                  </div>
                </>
              )}

              {/* Bounding boxes for detected leaves */}
              {orderedLeafIds.map((leafId, index) => {
                // Prefer AI leaf_regions for borders; fallback to crop bboxes.
                const aiBox = aiLeafRegionsById.get(leafId);
                const crop = leafCropById.get(leafId);
                if (!crop && !aiBox) return null;

                const bboxPx = aiBox && sourceDims
                  ? {
                      x: clamp01(aiBox.x) * sourceDims.w,
                      y: clamp01(aiBox.y) * sourceDims.h,
                      w: clamp01(aiBox.w) * sourceDims.w,
                      h: clamp01(aiBox.h) * sourceDims.h,
                    }
                  : crop?.bbox;

                if (!bboxPx) return null;

                const label = leafId || `Leaf ${index + 1}`;
                const isSelected = !selectedLeafId || selectedLeafId === label;

                const palette = ['#16a34a', '#2563eb', '#f59e0b']; // green, blue, amber
                const color = palette[index % palette.length];

                const left = (bboxPx.x / sourceDims.w) * 100;
                const top = (bboxPx.y / sourceDims.h) * 100;
                const width = (bboxPx.w / sourceDims.w) * 100;
                const height = (bboxPx.h / sourceDims.h) * 100;

                return (
                  <div
                    key={`${label}-${index}`}
                    className={`absolute rounded-lg transition-all ${
                      isSelected
                        ? 'shadow-[0_0_0_4px_rgba(255,255,255,0.25),0_0_0_1px_rgba(0,0,0,0.25)]'
                        : 'opacity-95'
                    } ${selectedLeafId ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`}
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    onClick={() => setSelectedLeafId(label)}
                  >
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        border: isSelected ? `3px solid ${color}` : `2px dashed ${color}`,
                        boxShadow: isSelected
                          ? `0 0 0 4px rgba(0,0,0,0.15)`
                          : `0 0 0 2px rgba(255,255,255,0.20)`,
                      }}
                    />

                    <div
                      className="absolute -top-3 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white border border-white/30"
                      style={{ backgroundColor: color }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time-travel controls */}
            <div className="mt-3 bg-white/70 border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
                  {t('time_travel', { defaultValue: 'Forecast Preview' })}
                </div>
                <div className="text-[11px] text-gray-600 font-mono">
                  {timeTravel === 0
                    ? t('now', { defaultValue: 'Now' })
                    : t('days_ahead', { defaultValue: '{{d}}d ahead', d: Math.max(1, dayIndex + 1) })}
                </div>
              </div>

              <div className="mt-2 flex items-center flex-wrap gap-2">
                <span className="text-[11px] text-gray-500 font-medium">
                  {forecastMode === 'live'
                    ? t('forecast_live', { defaultValue: 'Forecast: Live weather' })
                    : forecastMode === 'demo'
                      ? t('forecast_demo', { defaultValue: 'Forecast: Sample data' })
                      : t('forecast_unavailable', { defaultValue: 'Forecast: Not available' })}
                </span>
                {riskBadge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskBadge.className}`}>
                    {riskBadge.label}
                  </span>
                )}
                {activeForecast && (
                  <span className="text-[10px] text-gray-500 font-mono">
                    {activeForecast.dateKey} • {Math.round(activeForecast.avgTempC)}°C • {activeForecast.wetHours}h wet
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <span className="text-[11px] font-medium text-gray-500">{t('now', { defaultValue: 'Now' })}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={timeTravel}
                  onChange={(e) => setTimeTravel(Number(e.target.value))}
                  className="flex-1"
                  disabled={!futurePreview}
                />
                <span className="text-[11px] font-medium text-gray-500">{t('later', { defaultValue: 'Later' })}</span>
              </div>

              <div className="mt-2 text-[11px] text-gray-500 font-medium">
                {futurePreview
                  ? t('time_travel_note', {
                      defaultValue:
                        'Forecast-based visualization only. It is not a diagnosis and may be inaccurate. Monitor crops and consult local guidance.',
                    })
                  : isGeneratingFuture
                    ? t('generating_preview', { defaultValue: 'Generating preview…' })
                    : t('preview_unavailable', { defaultValue: 'Preview unavailable for this image.' })}
              </div>

              {forecastError && forecastMode === 'unavailable' && (
                <div className="mt-2 text-[11px] text-red-600">
                  {forecastError}
                </div>
              )}

              {activeForecast && activeForecast.drivers.length > 0 && (
                <div className="mt-2 text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-600">Drivers:</span> {activeForecast.drivers.join(' • ')}
                </div>
              )}
            </div>

            <p className="mt-2 text-[11px] text-gray-400 font-medium">
              {t('leaf_thumbnail_note', { defaultValue: 'Auto-cropped view (best effort).' })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-3">{t('vision_findings', { defaultValue: 'Vision Findings' })}</h4>
            <ul className="space-y-2">
              {data.visionEvidence?.anomalies_detected?.map((finding: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">{t('uncertainty_factors', { defaultValue: 'Uncertainty Factors' })}</h4>
            {data.uncertaintyFactors && Object.entries(data.uncertaintyFactors).some(([_k, v]) => v === true || (Array.isArray(v) && v.length > 0)) ? (
              <ul className="space-y-2">
                {data.uncertaintyFactors.lowImageQuality && (
                  <li className="flex items-center gap-2 text-sm text-amber-700"><AlertCircle className="w-4 h-4" /> {t('low_image_quality', { defaultValue: 'Low Image Quality' })}</li>
                )}
                {data.uncertaintyFactors.multipleLeaves && (
                  <li className="flex items-center gap-2 text-sm text-amber-700"><Leaf className="w-4 h-4" /> {t('multiple_leaves_detected', { defaultValue: 'Multiple Leaves Detected' })}</li>
                )}
                {data.uncertaintyFactors.visuallySimilarConditions && (
                  <li className="flex items-center gap-2 text-sm text-amber-700"><HelpCircle className="w-4 h-4" /> {t('ambiguous_symptoms', { defaultValue: 'Ambiguous Symptoms' })}</li>
                )}
                {data.uncertaintyFactors.other?.map((factor: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">• {factor}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">{t('no_major_uncertainty', { defaultValue: 'No major uncertainty factors detected.' })}</p>
            )}
          </div>
        </div>

        {/* Safety & Regulatory Compliance (hackathon judge-friendly) */}
        <div className="mt-6 bg-white/70 rounded-xl p-5 border border-gray-200">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            {t('safety_compliance', { defaultValue: 'Safety & Compliance Check' })}
          </h4>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-gray-700 font-medium">
              {t('compliance_explain', {
                defaultValue:
                  'This app avoids chemical dosing/mixing guidance. If any restricted chemical names appear in AI text, we flag it for safety review.',
              })}
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border self-start md:self-auto ${
                complianceHits.length === 0
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {complianceHits.length === 0
                ? t('compliance_ok', { defaultValue: 'No red-flags detected' })
                : t('compliance_flagged', { defaultValue: 'Flagged for review' })}
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-600 font-mono">
            {complianceSummary}
          </div>

          {complianceHits.length > 0 && (
            <div className="mt-3 text-xs text-red-700 bg-red-50/70 border border-red-200 rounded-lg p-3">
              {t('compliance_next_steps', {
                defaultValue:
                  'Do not act on chemical names from AI output. Verify legality and safety with local agricultural authorities/extension officers.',
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Leaf Assessments */}
      <div className="space-y-4">
        {data.leafAssessments && Array.isArray(data.leafAssessments) && data.leafAssessments.length > 0 ? (
          data.leafAssessments.map((leaf, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl p-6 border shadow-sm transition-all cursor-pointer ${
                selectedLeafId === leaf.id
                  ? 'border-green-400 shadow-md ring-4 ring-green-200/60'
                  : 'border-gray-200 hover:shadow-md hover:border-gray-300'
              }`}
              onClick={() => setSelectedLeafId(leaf.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-700 font-bold border border-green-100">
                    {leaf.id.split(' ')[1] || 'A'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{leaf.id}</h3>
                    <p className="text-xs text-gray-500">{leaf.condition === 'Unknown' ? t('condition_unclear', { defaultValue: 'Condition Unclear' }) : leaf.condition}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${leaf.confidence > 0.8 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {formatConfidence(leaf.confidence)} {t('confidence_short', { defaultValue: 'Conf' })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={leafCropById.get(leaf.id)?.dataUrl || leafCrops[index]?.dataUrl || sourceImage || ''}
                      alt={`${leaf.id} thumbnail`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400 font-medium">
                    {t('leaf_thumbnail_note', { defaultValue: 'Auto-cropped view (best effort).' })}
                  </p>
                </div>

                <div className="md:col-span-8 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('observations', { defaultValue: 'Observations' })}</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {leaf.observations.map((obs, i) => <li key={i}>• {obs}</li>)}
                    </ul>
                  </div>
                  {leaf.notes && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                      <strong>{t('note_label', { defaultValue: 'Note:' })}</strong> {leaf.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          /* Fallback for single leaf / legacy format */
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm text-center text-gray-500">
            {t('single_subject_assessed', { defaultValue: 'Single Subject Assessed. See Final Decision.' })}
          </div>
        )}
      </div>


      {/* 3. Final Decision & Guidance (Existing Block) */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 hidden md:block">
          <div className={`px-4 py-2 rounded-full border font-bold text-sm uppercase tracking-widest ${getVerdictStyles(data.arbitrationResult?.decision || 'Indeterminate')}`}>
            {verdictLabel || data.arbitrationResult?.decision}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <FileText className="w-7 h-7 text-green-600" />
          {t('verdict_title')}
        </h2>

        <div className="prose prose-green max-w-none text-lg text-gray-700 leading-relaxed font-medium">
          <ReactMarkdown>
            {data.explanation?.summary}
          </ReactMarkdown>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-8">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">{t('farmer_guidance')}</h4>
          <ul className="space-y-3">
            {data.explanation?.guidance?.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-700">
                <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                <span className="text-sm">
                  <ReactMarkdown components={{
                    p: ({ children }) => <span className="inline">{children}</span>,
                    strong: ({ children }) => <span className="font-bold text-gray-900">{children}</span>
                  }}>
                    {item}
                  </ReactMarkdown>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-6">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed font-medium">
          <strong className="block mb-1">{t('ethical_notice_title')}</strong>
          {t('ethical_notice_text')}
        </p>
      </div>
    </div>
  );
};
