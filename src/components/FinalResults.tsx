import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AssessmentData } from '../types';
import { useTranslation } from 'react-i18next';
import { AlertCircle, HelpCircle, Scan, Leaf, FileText } from 'lucide-react';
import { computeLeafCrops, LeafCrop } from '../lib/leafCrops';

interface FinalResultsProps {
  data: AssessmentData;
  sourceImage?: string | null;
}

export const FinalResults: React.FC<FinalResultsProps> = ({ data, sourceImage }) => {
  const { t } = useTranslation();

  const [leafCrops, setLeafCrops] = useState<LeafCrop[]>([]);
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number } | null>(null);

  const leafCount = useMemo(() => {
    const n = data.leafAssessments?.length || 0;
    return Math.min(3, Math.max(0, n));
  }, [data.leafAssessments?.length]);

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

        const crops = await computeLeafCrops(sourceImage, leafCount);
        if (!cancelled) setLeafCrops(crops);
      } catch {
        if (!cancelled) setLeafCrops([]);
        if (!cancelled) setSourceDims(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sourceImage, leafCount]);

  const formatConfidence = (value?: number) => {
    const num = typeof value === 'number' ? value : 0;
    const clamped = Math.max(0, Math.min(1, num));
    return `${Math.round(clamped * 100)}%`;
  };

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

              {/* Bounding boxes for detected leaves */}
              {leafCrops.map((crop, index) => {
                const leftPct = (crop.bbox.x / sourceDims.w) * 100;
                const topPct = (crop.bbox.y / sourceDims.h) * 100;
                const widthPct = (crop.bbox.w / sourceDims.w) * 100;
                const heightPct = (crop.bbox.h / sourceDims.h) * 100;
                const label = data.leafAssessments?.[index]?.id || `Leaf ${index + 1}`;

                return (
                  <div
                    key={`${label}-${index}`}
                    className="absolute border-2 border-green-600 rounded-lg pointer-events-none"
                    style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
                  >
                    <div className="absolute -top-3 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-600 text-white border border-white/30">
                      {label}
                    </div>
                  </div>
                );
              })}
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
      </div>

      {/* 2. Leaf Assessments */}
      <div className="space-y-4">
        {data.leafAssessments && Array.isArray(data.leafAssessments) && data.leafAssessments.length > 0 ? (
          data.leafAssessments.map((leaf, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
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
                      src={leafCrops[index]?.dataUrl || sourceImage || ''}
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
