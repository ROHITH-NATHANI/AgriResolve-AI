import React from 'react';
import { HypothesisResult } from '../types';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface HypothesisDebateProps {
  healthy: HypothesisResult;
  disease: HypothesisResult;
  isVisible: boolean;
}

export const HypothesisDebate: React.FC<HypothesisDebateProps> = ({ healthy, disease, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Healthy Agent Card */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 leading-tight">Healthy Hypothesis</h3>
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Defense Agent</p>
          </div>
          <div className="ml-auto bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
            {(healthy?.score * 100).toFixed(0)}% Conf
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-sm text-gray-700 leading-relaxed">
          <ul className="list-disc pl-4 space-y-2 marker:text-blue-400">
            {healthy?.arguments?.map((arg, i) => (
              <li key={i}>{arg}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disease Agent Card */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 leading-tight">Disease Hypothesis</h3>
            <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pathology Agent</p>
          </div>
          <div className="ml-auto bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
            {(disease?.score * 100).toFixed(0)}% Conf
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-sm text-gray-700 leading-relaxed">
          <ul className="list-disc pl-4 space-y-2 marker:text-red-400">
            {disease?.arguments?.map((arg, i) => (
              <li key={i}>{arg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
