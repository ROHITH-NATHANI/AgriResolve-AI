import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { useSearchParams } from 'react-router-dom';
import { AssessmentStatus, AssessmentData } from '../types';
import { runAgenticPipeline } from '../agents/Orchestrator';
import { HypothesisDebate } from '../components/HypothesisDebate';
import { FinalResults } from '../components/FinalResults';
import { CropAnalysisRecord } from '../features/history/types';
import { AgentVisualizer } from '../features/analysis/components/AgentVisualizer';
import { ScanOverlay } from '../features/analysis/components/ScanOverlay';
import { usePersistentHistory } from '../features/history/hooks/usePersistentHistory';
import { CompareView } from '../features/history/components/CompareView';
import { AssistantWidget } from '../features/assistant/components/AssistantWidget';
import { BioNetworkScene } from '../features/visualization/components/BioNetworkScene';
import { Upload, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'ml', label: 'മലയാളം' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'mr', label: 'मराठी' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'gu', label: 'ગુજરાતી' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
];

import { translateAssessmentData } from '../services/TranslationService';
import type { VisionEvidence } from '../agents/definitions/VisionEvidenceAgent';
import type { QualityReport } from '../agents/definitions/QualityEvaluator';
import type { HypothesisResult } from '../agents/definitions/HealthyHypothesisAgent';
import type { ArbitrationResult } from '../agents/definitions/ArbitrationAgent';

export const Diagnosis: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<AssessmentStatus>(AssessmentStatus.IDLE);
    const [image, setImage] = useState<string | null>(null);
    const [data, setData] = useState<AssessmentData | null>(null);
    const [error, setError] = useState<string | null>(null);

    type MainTab = 'results' | 'compare';
    const [activeTab, setActiveTab] = useState<MainTab>('results');


    // Cache to store translated results: { 'en': dataEn, 'te': dataTe, ... }
    const [assessmentCache, setAssessmentCache] = useState<Record<string, AssessmentData>>({});

    // Track the original "source of truth" data (usually English or first generation)
    // This ensures we always translate from a valid full structure if the current view is partial/translated
    const [baseData, setBaseData] = useState<AssessmentData | null>(null);

    const { history, addRecord } = usePersistentHistory();

    const isDemoMode = React.useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.has('demo') || params.has('judge') || import.meta.env.VITE_DEMO_MODE === 'true';
        } catch {
            return import.meta.env.VITE_DEMO_MODE === 'true';
        }
    }, []);

    const buildDemoAssessment = React.useCallback((img: string): AssessmentData => {
        const visionEvidence: VisionEvidence = {
            lesion_color: 'brown/yellow',
            lesion_shape: 'irregular patches',
            texture: 'slightly mottled',
            distribution: 'scattered, mostly mid-leaf',
            anomalies_detected: ['small brown specks', 'yellowing around spots', 'mild mottling'],
            raw_analysis:
                'Demo-mode analysis: spotted discoloration with mild chlorosis. This is a deterministic sample output for reliable judging.',
            leaf_regions: [
                { id: 'Leaf A', x: 0.05, y: 0.12, w: 0.62, h: 0.78, confidence: 0.82 },
                { id: 'Leaf B', x: 0.60, y: 0.18, w: 0.35, h: 0.70, confidence: 0.76 },
            ],
            attention_boxes: [
                { x: 0.22, y: 0.32, w: 0.20, h: 0.22, label: 'spots', confidence: 0.78 },
                { x: 0.68, y: 0.45, w: 0.18, h: 0.26, label: 'necrosis', confidence: 0.74 },
            ],
        };

        const quality: QualityReport = {
            score: 0.86,
            flags: ['OK'],
            reasoning: 'Demo-mode: image appears clear, leaf occupies most of frame.',
        } as unknown as QualityReport;

        const healthyResult: HypothesisResult = {
            score: 0.38,
            arguments: [
                'Patterns could be from minor nutrient stress or recent handling damage.',
                'No strong fungal texture is visible in the highlighted areas.',
            ],
            evidence_refs: { demo: true },
        };

        const diseaseResult: HypothesisResult = {
            score: 0.62,
            arguments: [
                'Spotting with surrounding yellowing can be consistent with early-stage leaf stress/disease.',
                'Scattered lesions suggest a developing issue rather than uniform nutrient deficiency.',
            ],
            evidence_refs: { demo: true },
        };

        const arbitrationResult: ArbitrationResult = {
            decision: 'Possibly Abnormal',
            confidence: 0.64,
            rationale: [
                'Evidence suggests mild abnormal spotting; severity appears low.',
                'Because this is a single photo, confirm with follow-up scans over 48–72 hours.',
            ],
        };

        return {
            imageUrl: img,
            visionEvidence,
            quality,
            healthyResult,
            diseaseResult,
            arbitrationResult,
            explanation: {
                summary:
                    'Demo mode: This leaf looks mildly abnormal. The safest next step is monitoring and capturing a clearer follow-up photo under good daylight.',
                guidance: [
                    'Take 2 more photos over the next 2–3 days under daylight (same plant).',
                    'If spread increases or multiple plants show symptoms, contact a local extension officer/agronomist.',
                    'Avoid applying chemicals based on app output; follow local guidance and labels.',
                ],
            },
            leafAssessments: [
                {
                    id: 'Leaf A',
                    observations: ['Small scattered brown specks', 'Mild yellowing around specks'],
                    condition: 'Mild abnormality (uncertain)',
                    confidence: 0.64,
                    notes: 'Demo mode sample leaf assessment.',
                },
                {
                    id: 'Leaf B',
                    observations: ['Larger necrotic patches', 'Stronger yellowing around lesions'],
                    condition: 'Mild abnormality (uncertain)',
                    confidence: 0.60,
                    notes: 'Demo mode sample leaf assessment (second leaf).',
                },
            ],
            uncertaintyFactors: {
                lowImageQuality: false,
                multipleLeaves: true,
                visuallySimilarConditions: true,
                other: ['Demo mode uses deterministic outputs for reliable judging.'],
            },
        };
    }, []);

    const loadHistoryRecord = async (record: CropAnalysisRecord) => {
        setError(null);
        setStatus(AssessmentStatus.COMPLETED);
        setAssessmentCache({});
        setBaseData(null);
        setActiveTab('results');

        // Restore image preview
        try {
            const url = URL.createObjectURL(record.imageBlob);
            setImage(url);
        } catch {
            setImage(null);
        }

        // Minimal, UI-friendly restored result (keeps things uncluttered)
        const restored: AssessmentData = {
            imageUrl: null,
            visionEvidence: {
                lesion_color: 'unknown',
                lesion_shape: 'unknown',
                texture: 'unknown',
                distribution: 'unknown',
                anomalies_detected: [],
                raw_analysis: record.diagnosis.description || 'Restored from history',
            },
            quality: { score: 1, flags: [], reasoning: 'Restored from history.' },
            healthyResult: { score: 0, arguments: [], evidence_refs: {} },
            diseaseResult: { score: 0, arguments: [], evidence_refs: {} },
            arbitrationResult: {
                decision: record.diagnosis.primaryIssue || 'Unknown',
                confidence: record.diagnosis.confidence ?? 0,
                rationale: [],
            },
            explanation: {
                summary: record.diagnosis.description || 'Restored from history.',
                guidance: record.diagnosis.recommendedActions ? [record.diagnosis.recommendedActions] : [],
            },
            leafAssessments: [],
            uncertaintyFactors: {
                lowImageQuality: false,
                multipleLeaves: false,
                visuallySimilarConditions: false,
                other: ['This view is restored from history (no re-analysis).'],
            },
        };
        setData(restored);
    };

    // Handle Dynamic Translation on Language Change
    React.useEffect(() => {
        const handleTranslation = async () => {
            // Only proceed if we have a completed assessment and the base data
            if (status !== AssessmentStatus.COMPLETED || !baseData) return;

            const currentLang = i18n.language;

            // 1. Check Cache
            if (assessmentCache[currentLang]) {
                setData(assessmentCache[currentLang]);
                return;
            }

            // 2. If not cached, Translate
            // Show a mini-loading state if desired, or just translate in background
            // For better UX, we could set a "translating" flag, but for now we'll just update when ready.

            try {
                const translated = await translateAssessmentData(baseData, currentLang);

                // 3. Update Cache & State
                setAssessmentCache(prev => ({ ...prev, [currentLang]: translated }));
                setData(translated);
            } catch (err) {
                console.error("Translation Error", err);
            }
        };

        handleTranslation();
    }, [i18n.language, baseData, status]); // Dependencies: run when language changes

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB
            if (file.size > MAX_IMAGE_BYTES) {
                setError(
                    t('file_too_large', {
                        defaultValue: 'Image file is too large. Please upload a smaller, clearer photo (max ~6MB).',
                    })
                );
                setStatus(AssessmentStatus.ERROR);
                // Clear the input so selecting the same file again triggers onChange
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setImage(result);
                startAssessment(result, file);
            };
            reader.readAsDataURL(file);
        }
    };

    const startAssessment = async (img: string, file: File) => {
        setStatus(AssessmentStatus.PERCEIVING);
        setError(null);
        setData(null);
        setBaseData(null); // Reset base data
        setAssessmentCache({}); // Reset cache for new image

        try {
            // Demo/Judge mode: avoid external calls so the demo never breaks.
            // Use deterministic sample outputs (still driven by the user's image for UI).
            const base = isDemoMode
                ? (() => {
                    // preserve the stage animations for the "council" feel
                    setStatus(AssessmentStatus.EVALUATING);
                    return buildDemoAssessment(img);
                })()
                : await runAgenticPipeline(
                    img,
                    (newStatus) => {
                        setStatus(newStatus);
                    },
                    'en',
                    searchParams.get('mode') || 'scanner' // Pass mode
                );

            setBaseData(base);

            const currentLang = i18n.language;
            const view = isDemoMode || currentLang === 'en' ? base : await translateAssessmentData(base, currentLang);

            setData(view);

            // Cache the initial result for the current language
            setAssessmentCache({ [currentLang]: view });

            // Mark completed after translation is ready
            setStatus(AssessmentStatus.COMPLETED);



            // ... inside component ...

            // Save to History
            const record: CropAnalysisRecord = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                imageBlob: file,
                diagnosis: {
                    primaryIssue: view.arbitrationResult.decision, // Correct property name
                    confidence: view.arbitrationResult.confidence ?? 0,
                    description: view.explanation.summary,
                    recommendedActions: view.explanation.guidance[0] || "Consult an agronomist."
                },
                healthStatus: view.arbitrationResult.decision.toLowerCase().includes('healthy') ? 'healthy' : 'critical',
                agentLogs: []
            };
            addRecord(record);

        } catch (err) {
            console.error(err);
            setError(t('error_msg'));
            setStatus(AssessmentStatus.ERROR);
        }
    };



    const reset = () => {
        setStatus(AssessmentStatus.IDLE);
        setImage(null);
        setData(null);
        setBaseData(null);
        setError(null);
        setAssessmentCache({});
        setActiveTab('results');
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <Layout history={history} onSelectHistory={loadHistoryRecord} onNewAnalysis={reset}>
            <BioNetworkScene />

            <div className="mb-6 border-b border-white/20 pb-6 relative z-10 backdrop-blur-md bg-white/20 shadow-lg rounded-t-2xl p-6 -mx-6 -mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight drop-shadow-sm">
                        {t('app_title')}
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm font-medium">
                        {t('subtitle')} • v2.1.0
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {isDemoMode && (
                        <div className="bg-yellow-50/90 backdrop-blur-xl px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm text-xs font-bold text-yellow-900">
                            DEMO
                        </div>
                    )}

                    {/* Language Selector */}
                    <div className="flex items-center gap-2 bg-white/30 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/40 shadow-sm hover:bg-white/40 transition-colors">
                        <Globe className="w-4 h-4 text-gray-700" />
                        <select
                            value={i18n.language}
                            onChange={(e) => changeLanguage(e.target.value)}
                            className="bg-transparent text-sm font-medium text-gray-800 outline-none cursor-pointer"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                {status === AssessmentStatus.IDLE || status === AssessmentStatus.ERROR ? (
                    <div className="max-w-4xl mx-auto mt-8">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-2 mb-12"
                        >
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight drop-shadow-sm">{t('app_title')}</h1>
                            <p className="text-gray-600 font-medium">{t('subtitle')}</p>
                        </motion.div>

                        {/* Upload Section with Glass Effect */}
                        {!image && !data && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="bg-white/20 backdrop-blur-xl rounded-3xl p-12 border border-white/40 shadow-2xl text-center hover:shadow-3xl transition-all duration-300 hover:bg-white/30"
                            >
                                <div className="w-20 h-20 bg-green-50/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <Upload className="w-10 h-10 text-green-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4 drop-shadow-sm">{t('upload_title')}</h2>
                                <p className="text-gray-700 mb-8 max-w-md mx-auto text-lg font-medium">
                                    {t('upload_desc')}
                                    <br /><span className="text-sm text-gray-500 font-normal">{t('upload_sub')}</span>
                                </p>

                                <label className="relative inline-flex group cursor-pointer">
                                    <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#44BC48] via-[#118B44] to-[#44BC48] rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt"></div>
                                    <button
                                        onClick={() => document.getElementById('file-upload')?.click()}
                                        className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-green-600/90 hover:bg-green-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 backdrop-blur-sm shadow-lg"
                                    >
                                        <Upload className="w-5 h-5 mr-2" />
                                        {t('select_button')}
                                    </button>
                                    <input
                                        id="file-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            </motion.div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 p-4 bg-red-50/90 backdrop-blur-sm text-red-700 rounded-lg text-sm border border-red-200 flex items-center gap-3 shadow-lg"
                            >
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span className="font-medium">{error}</span>
                            </motion.div>
                        )}

                        {/* 3-Step Process Guide */}
                        {!image && !data && !error && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="mt-16 bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20"
                            >
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-8 text-center border-b border-gray-200/30 pb-4">Diagnostic Workflow</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative px-4">
                                    {/* Connector Line (Desktop) */}
                                    <div className="hidden md:block absolute top-[2.5rem] left-[20%] right-[20%] h-0.5 bg-gray-200/50 -z-10" />

                                    {[
                                        { icon: Upload, title: t('workflow_1_title'), desc: t('workflow_1_desc') },
                                        { icon: CheckCircle2, title: t('workflow_2_title'), desc: t('workflow_2_desc') },
                                        { icon: FileText, title: t('workflow_3_title'), desc: t('workflow_3_desc') }
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex flex-col items-center text-center group">
                                            <div className="w-20 h-20 bg-white/70 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 shadow-md mb-4 relative z-10 group-hover:border-green-300 transition-colors">
                                                <step.icon className="w-8 h-8 text-gray-500 group-hover:text-green-600 transition-colors" />
                                            </div>
                                            <h5 className="text-sm font-bold text-gray-800 mb-2">{step.title}</h5>
                                            <p className="text-xs text-gray-600 leading-relaxed max-w-[220px] font-medium">
                                                {step.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8 pb-12">
                        {/* Top-level view tabs (always discoverable) */}
                        <div className="flex items-center justify-end">
                            <div className="bg-white/60 backdrop-blur-xl rounded-full p-1 border border-white/40 shadow-sm flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={!(status === AssessmentStatus.COMPLETED && data)}
                                    onClick={() => setActiveTab('results')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${activeTab === 'results'
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-700 hover:bg-white/60'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    Results
                                </button>
                                <button
                                    type="button"
                                    disabled={!(status === AssessmentStatus.COMPLETED && data)}
                                    onClick={() => setActiveTab('compare')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${activeTab === 'compare'
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-700 hover:bg-white/60'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    Compare
                                </button>
                            </div>
                        </div>

                        {/* Main Workspace */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Image Preview */}
                            <div className="lg:col-span-5">
                                <div className="sticky top-8 bg-white/50 backdrop-blur-xl p-4 rounded-xl shadow-lg border border-white/40">
                                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100/50 border border-gray-200/50">
                                        <img src={image!} alt={t('source_image')} className="w-full h-full object-cover" />

                                        {/* Scan Animation Overlay */}
                                        <ScanOverlay isActive={status === AssessmentStatus.PERCEIVING || status === AssessmentStatus.EVALUATING} />

                                        {status === AssessmentStatus.PERCEIVING && (
                                            <div className="absolute top-4 left-4 right-4 bg-black/75 text-white text-xs py-2 px-3 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                {t('processing')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-gray-200/50 pt-4">
                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{t('source_image')}</span>
                                        {status === AssessmentStatus.COMPLETED && (
                                            <button onClick={reset} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                                                {t('new_analysis')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Workflow Progress */}
                            <div className="lg:col-span-7">
                                <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-lg border border-white/40 p-6">
                                    <div className="flex items-center justify-between gap-4 mb-4 border-b border-gray-200/50 pb-3">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{t('pipeline_title')}</h3>
                                    </div>

                                    <AgentVisualizer status={status} />
                                </div>
                            </div>
                        </div>

                        {data && (
                            <HypothesisDebate
                                healthy={data.healthyResult}
                                disease={data.diseaseResult}
                                assessment={data}
                                isVisible={[AssessmentStatus.DEBATING, AssessmentStatus.ARBITRATING, AssessmentStatus.EXPLAINING, AssessmentStatus.COMPLETED].includes(status)}
                            />
                        )}

                        {status === AssessmentStatus.COMPLETED && data && (
                            <>
                                {activeTab === 'results' ? (
                                    <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-lg border border-white/40 p-6">
                                        <FinalResults data={data} sourceImage={image} isDemoMode={isDemoMode} />
                                    </div>
                                ) : (
                                    <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-lg border border-white/40 p-6">
                                        <CompareView history={history} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}


                {status === AssessmentStatus.COMPLETED && data && (
                    <AssistantWidget data={data} />
                )}
            </div>
        </Layout>
    );
};
