import React, { useState, useRef } from 'react';
import { Layout } from './components/Layout';
import { AssessmentStatus, AssessmentData } from './types';
import { runAgenticPipeline } from './agents/Orchestrator';
import { HypothesisDebate } from './components/HypothesisDebate';
import { FinalResults } from './components/FinalResults';
import { AgentVisualizer } from './features/analysis/components/AgentVisualizer';
import { ScanOverlay } from './features/analysis/components/ScanOverlay';
import { usePersistentHistory } from './features/history/hooks/usePersistentHistory';
import { AssistantWidget } from './features/assistant/components/AssistantWidget';
import { BioNetworkScene } from './features/visualization/components/BioNetworkScene';
import { Upload, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

import { translateAssessmentData } from './services/TranslationService';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<AssessmentStatus>(AssessmentStatus.IDLE);
  const [image, setImage] = useState<string | null>(null);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache to store translated results: { 'en': dataEn, 'te': dataTe, ... }
  const [assessmentCache, setAssessmentCache] = useState<Record<string, AssessmentData>>({});

  // Track the original "source of truth" data (usually English or first generation)
  // This ensures we always translate from a valid full structure if the current view is partial/translated
  const [baseData, setBaseData] = useState<AssessmentData | null>(null);

  const { history, addRecord } = usePersistentHistory();

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
      // Pass current language to the pipeline
      const result = await runAgenticPipeline(img, (newStatus) => {
        setStatus(newStatus);
      }, i18n.language);

      setData(result);
      setBaseData(result); // Store as base for future translations

      // Cache the initial result for the current language
      setAssessmentCache({ [i18n.language]: result });

      // Save to History
      const record = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        imageBlob: file,
        diagnosis: {
          primaryIssue: result.arbitrationResult.decision, // Correct property name
          confidence: result.arbitrationResult.confidence_score,
          description: result.explanation.summary,
          recommendedActions: result.explanation.guidance[0] || "Consult an agronomist."
        },
        healthStatus: result.healthyResult.is_healthy ? 'healthy' : 'critical',
        agentLogs: []
      };
      addRecord(record as any);

    } catch (err) {
      console.error(err);
      setError(t('error_msg'));
      setStatus(AssessmentStatus.ERROR);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const reset = () => {
    setStatus(AssessmentStatus.IDLE);
    setImage(null);
    setData(null);
    setBaseData(null);
    setError(null);
    setAssessmentCache({});
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <Layout history={history} onSelectHistory={() => { }}>
      <BioNetworkScene />

      <div className="mb-6 border-b border-gray-200/50 pb-6 relative z-10 backdrop-blur-sm bg-white/30 rounded-t-2xl p-6 -mx-6 -mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('app_title')}
          </h2>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {t('subtitle')} • v2.1.0
          </p>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
          <Globe className="w-4 h-4 text-gray-500" />
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
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
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">{t('app_title')}</h1>
              <p className="text-gray-500 font-medium">{t('subtitle')}</p>
            </motion.div>

            {/* Upload Section with Scale Animation */}
            {!image && !data && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-white/80 backdrop-blur-md rounded-3xl p-12 border border-green-100 shadow-xl text-center hover:shadow-2xl transition-shadow duration-300"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('upload_title')}</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
                  {t('upload_desc')}
                  <br /><span className="text-sm text-gray-400">{t('upload_sub')}</span>
                </p>

                <label className="relative inline-flex group cursor-pointer">
                  <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#44BC48] via-[#118B44] to-[#44BC48] rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt"></div>
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-green-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
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
                className="mt-8 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-center gap-3 shadow-sm"
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
                className="mt-16"
              >
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8 text-center border-b border-gray-100 pb-4">Diagnostic Workflow</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative px-4">
                  {/* Connector Line (Desktop) */}
                  <div className="hidden md:block absolute top-[2.5rem] left-[20%] right-[20%] h-0.5 bg-gray-100 -z-10" />

                  {[
                    { icon: Upload, title: t('workflow_1_title'), desc: t('workflow_1_desc') },
                    { icon: CheckCircle2, title: t('workflow_2_title'), desc: t('workflow_2_desc') },
                    { icon: FileText, title: t('workflow_3_title'), desc: t('workflow_3_desc') }
                  ].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center group">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-2 border-gray-100 shadow-sm mb-4 relative z-10 group-hover:border-green-200 transition-colors">
                        <step.icon className="w-8 h-8 text-gray-400 group-hover:text-green-600 transition-colors" />
                      </div>
                      <h5 className="text-sm font-bold text-gray-900 mb-2">{step.title}</h5>
                      <p className="text-xs text-gray-500 leading-relaxed max-w-[220px]">
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
            {/* Main Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Image Preview */}
              <div className="lg:col-span-5">
                <div className="sticky top-8 bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={image!} alt="Uploaded leaf" className="w-full h-full object-cover" />

                    {/* Scan Animation Overlay */}
                    <ScanOverlay isActive={status === AssessmentStatus.PERCEIVING || status === AssessmentStatus.EVALUATING} />

                    {status === AssessmentStatus.PERCEIVING && (
                      <div className="absolute top-4 left-4 right-4 bg-black/75 text-white text-xs py-2 px-3 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Processing Image Data...
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Image</span>
                    {status === AssessmentStatus.COMPLETED && (
                      <button onClick={reset} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                        Start New Analysis
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Workflow Progress */}
              <div className="lg:col-span-7">
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-b border-gray-100 pb-2">Analysis Pipeline</h3>
                  <AgentVisualizer status={status} />
                </div>
              </div>
            </div>

            <HypothesisDebate
              healthy={data?.healthyResult!}
              disease={data?.diseaseResult!}
              isVisible={[AssessmentStatus.DEBATING, AssessmentStatus.ARBITRATING, AssessmentStatus.EXPLAINING, AssessmentStatus.COMPLETED].includes(status)}
            />

            {status === AssessmentStatus.COMPLETED && data && (
              <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-gray-200 p-6">
                <FinalResults data={data} />
              </div>
            )}
          </div>
        )}

        <AssistantWidget data={data} />
      </div>
    </Layout>
  );
};

export default App;
