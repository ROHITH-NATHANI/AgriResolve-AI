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
import { Upload, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AssessmentStatus>(AssessmentStatus.IDLE);
  const [image, setImage] = useState<string | null>(null);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { history, addRecord } = usePersistentHistory();

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

    try {
      const result = await runAgenticPipeline(img, (newStatus) => {
        setStatus(newStatus);
      });
      setData(result);

      // Save to History
      const record = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        imageBlob: file, // File is a Blob
        diagnosis: {
          primaryIssue: result.arbitrationResult.final_diagnosis,
          confidence: result.arbitrationResult.confidence_score,
          description: result.explanation.summary,
          recommendedActions: result.explanation.guidance[0] || "Consult an agronomist."
        },
        healthStatus: result.healthyResult.is_healthy ? 'healthy' : 'critical', // Simplified logic
        agentLogs: [] // Can populate if needed
      };
      // Type assertion or update types to match exactly if needed
      addRecord(record as any);

    } catch (err) {
      console.error(err);
      setError('An error occurred during assessment. Please try with a clearer image.');
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
    setError(null);
  };

  return (
    <Layout history={history} onSelectHistory={() => { }}>
      <div className="mb-6 border-b border-gray-200 pb-6">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          Crop Health Diagnostic
        </h2>
        <p className="text-gray-500 mt-1 text-sm font-medium">
          Multi-Agent Analysis System • v2.1.0 (Stable)
        </p>
      </div>

      {status === AssessmentStatus.IDLE || status === AssessmentStatus.ERROR ? (
        <div className="max-w-4xl mx-auto mt-8">

          {/* Primary Action Card */}
          <div
            onClick={triggerUpload}
            className="group flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-2xl bg-white hover:bg-gray-50 hover:border-green-600 transition-all cursor-pointer shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-green-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

            <div className="relative">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-0 group-hover:opacity-75 duration-1000" />
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-green-100 relative z-10">
                <Upload className="w-10 h-10 text-green-700" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Upload Leaf Image</h3>
            <p className="text-gray-600 text-base mt-3 text-center max-w-md font-medium leading-relaxed">
              Upload a clear image of a single leaf to begin analysis.
              <br />
              <span className="text-sm text-gray-400 font-normal mt-1 block">Supported formats: JPEG, PNG</span>
            </p>

            <button className="mt-8 px-8 py-3 bg-green-700 text-white rounded-lg text-sm font-bold tracking-wide uppercase shadow-md hover:bg-green-800 transition-all transform group-hover:translate-y-[-2px] flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Select Image File
            </button>
          </div>

          {/* 3-Step Process Guide */}
          <div className="mt-16">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8 text-center border-b border-gray-100 pb-4">Diagnostic Workflow</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative px-4">
              {/* Connector Line (Desktop) */}
              <div className="hidden md:block absolute top-[2.5rem] left-[20%] right-[20%] h-0.5 bg-gray-100 -z-10" />

              {[
                { icon: Upload, title: "1. Upload Sample", desc: "Use a clear, focused image of the affected area with good lighting." },
                { icon: CheckCircle2, title: "2. Automated Analysis", desc: "Our multi-agent grid evaluates visual symptoms & image quality." },
                { icon: FileText, title: "3. Review Results", desc: "Receive an explainable diagnosis with confidence scores & treatment guidance." }
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
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          {error && (
            <div className="mt-8 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 pb-12">
          {/* Main Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Image Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-b border-gray-100 pb-2">Analysis Pipeline</h3>
                <AgentVisualizer status={status} />
              </div>
            </div>
          </div>

          <HypothesisDebate
            healthy={data?.healthyResult}
            disease={data?.diseaseResult}
            isVisible={[AssessmentStatus.DEBATING, AssessmentStatus.ARBITRATING, AssessmentStatus.EXPLAINING, AssessmentStatus.COMPLETED].includes(status)}
          />

          {status === AssessmentStatus.COMPLETED && data && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <FinalResults data={data} />
            </div>
          )}
        </div>
      )}
      <AssistantWidget data={data} />
    </Layout>
  );
};

export default App;
