import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CropAnalysisRecord } from '../types';

interface CompareViewProps {
  history: CropAnalysisRecord[];
}

function formatTimestamp(ts: number, locale: string) {
  try {
    return new Date(ts).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

function formatPct(value: number | undefined) {
  const num = typeof value === 'number' ? value : 0;
  const clamped = Math.max(0, Math.min(1, num));
  return `${Math.round(clamped * 100)}%`;
}

function formatDeltaPct(next: number | undefined, prev: number | undefined) {
  const a = typeof prev === 'number' ? prev : 0;
  const b = typeof next === 'number' ? next : 0;
  const delta = Math.round((b - a) * 100);
  if (delta === 0) return '0%';
  return `${delta > 0 ? '+' : ''}${delta}%`;
}

function badgeForHealth(status: CropAnalysisRecord['healthStatus']) {
  switch (status) {
    case 'healthy':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  }
}

export const CompareView: React.FC<CompareViewProps> = ({ history }) => {
  const { t, i18n } = useTranslation();

  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');

  useEffect(() => {
    // Default: compare newest (left) vs second newest (right)
    if (history.length >= 2 && (!leftId || !rightId)) {
      setLeftId((prev) => prev || history[0].id);
      setRightId((prev) => prev || history[1].id);
      return;
    }

    if (history.length === 1 && !leftId) {
      setLeftId(history[0].id);
    }
  }, [history, leftId, rightId]);

  const left = useMemo(() => history.find((r) => r.id === leftId), [history, leftId]);
  const right = useMemo(() => history.find((r) => r.id === rightId), [history, rightId]);

  const leftImgUrl = useMemo(() => {
    if (!left?.imageBlob) return null;
    try {
      return URL.createObjectURL(left.imageBlob);
    } catch {
      return null;
    }
  }, [left?.imageBlob]);

  const rightImgUrl = useMemo(() => {
    if (!right?.imageBlob) return null;
    try {
      return URL.createObjectURL(right.imageBlob);
    } catch {
      return null;
    }
  }, [right?.imageBlob]);

  useEffect(() => {
    return () => {
      if (leftImgUrl) URL.revokeObjectURL(leftImgUrl);
      if (rightImgUrl) URL.revokeObjectURL(rightImgUrl);
    };
  }, [leftImgUrl, rightImgUrl]);

  const sameSelection = leftId && rightId && leftId === rightId;
  const hasEnough = history.length >= 2;

  const issueChanged = Boolean(left && right && left.diagnosis.primaryIssue !== right.diagnosis.primaryIssue);
  const confidenceDelta = left && right ? formatDeltaPct(right.diagnosis.confidence, left.diagnosis.confidence) : '—';

  const swap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t('compare_title', { defaultValue: 'Compare History Scans' })}</h3>
          <p className="text-xs text-gray-600 font-medium">
            {t('compare_subtitle', {
              defaultValue: 'Pick two past scans and see what changed in the verdict and confidence.',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={swap}
            disabled={!leftId || !rightId || sameSelection}
            className="px-3 py-1.5 text-xs font-bold rounded-full bg-white/70 hover:bg-white border border-white/60 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('swap', { defaultValue: 'Swap' })}
          </button>
        </div>
      </div>

      {!hasEnough ? (
        <div className="bg-white/70 border border-white/50 rounded-xl p-5 text-sm text-gray-700">
          {t('compare_need_two', { defaultValue: 'You need at least 2 saved scans in History to compare.' })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                {t('compare_left', { defaultValue: 'Scan A (baseline)' })}
              </label>
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                className="w-full bg-white/80 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-green-500/40"
              >
                {history.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatTimestamp(r.timestamp, i18n.language)} — {r.diagnosis.primaryIssue || t('unknown_issue', { defaultValue: 'Unknown' })}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                {t('compare_right', { defaultValue: 'Scan B (compare to A)' })}
              </label>
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                className="w-full bg-white/80 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-green-500/40"
              >
                {history.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatTimestamp(r.timestamp, i18n.language)} — {r.diagnosis.primaryIssue || t('unknown_issue', { defaultValue: 'Unknown' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sameSelection && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs font-medium text-yellow-900">
              {t('compare_same_warning', { defaultValue: 'Pick two different scans to compare.' })}
            </div>
          )}

          {/* Summary */}
          <div className="bg-white/70 border border-white/50 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                {t('compare_summary', { defaultValue: 'Summary' })}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${issueChanged ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                {issueChanged ? t('issue_changed', { defaultValue: 'Issue changed' }) : t('issue_same', { defaultValue: 'Issue same' })}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-gray-50 text-gray-700 border-gray-200">
                {t('confidence_delta', { defaultValue: 'Confidence Δ' })}: {confidenceDelta}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">{t('scan_a', { defaultValue: 'Scan A' })}</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 truncate">{left?.diagnosis.primaryIssue || '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${left ? badgeForHealth(left.healthStatus) : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {left?.healthStatus || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono">{left ? formatTimestamp(left.timestamp, i18n.language) : '—'}</div>
                  <div className="text-xs text-gray-700">
                    <span className="font-bold">{t('confidence', { defaultValue: 'Confidence' })}:</span> {formatPct(left?.diagnosis.confidence)}
                  </div>
                </div>
              </div>

              <div className="md:col-span-6">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">{t('scan_b', { defaultValue: 'Scan B' })}</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 truncate">{right?.diagnosis.primaryIssue || '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${right ? badgeForHealth(right.healthStatus) : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {right?.healthStatus || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono">{right ? formatTimestamp(right.timestamp, i18n.language) : '—'}</div>
                  <div className="text-xs text-gray-700">
                    <span className="font-bold">{t('confidence', { defaultValue: 'Confidence' })}:</span> {formatPct(right?.diagnosis.confidence)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-side details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white/70 border border-white/50 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{t('scan_a', { defaultValue: 'Scan A' })}</div>
                  <div className="text-sm font-bold text-gray-900 truncate">{left?.diagnosis.primaryIssue || '—'}</div>
                </div>
                {leftImgUrl && (
                  <img src={leftImgUrl} alt="Scan A" className="w-16 h-12 rounded-md object-cover border border-white/60" />
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{t('description', { defaultValue: 'Description' })}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{left?.diagnosis.description || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{t('recommended_actions', { defaultValue: 'Recommended actions' })}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{left?.diagnosis.recommendedActions || '—'}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white/70 border border-white/50 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{t('scan_b', { defaultValue: 'Scan B' })}</div>
                  <div className="text-sm font-bold text-gray-900 truncate">{right?.diagnosis.primaryIssue || '—'}</div>
                </div>
                {rightImgUrl && (
                  <img src={rightImgUrl} alt="Scan B" className="w-16 h-12 rounded-md object-cover border border-white/60" />
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{t('description', { defaultValue: 'Description' })}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{right?.diagnosis.description || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{t('recommended_actions', { defaultValue: 'Recommended actions' })}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{right?.diagnosis.recommendedActions || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
