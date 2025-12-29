import React from 'react';
import { HistorySidebar } from '../features/history/components/HistorySidebar';
import { CropAnalysisRecord } from '../features/history/types';
import { ShieldCheck } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  history?: CropAnalysisRecord[];
  onSelectHistory?: (record: CropAnalysisRecord) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, history = [], onSelectHistory = () => { } }) => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row font-inter bg-gray-50">
      {/* Sidebar - Professional & Solid */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 text-gray-900 flex flex-col shadow-sm relative z-30">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/logo.svg" alt="AgroResolve Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">AgroResolve</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700 tracking-wide uppercase">System Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="p-4 pb-2 bg-gray-50/50 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Diagnostics</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <HistorySidebar history={history} onSelect={onSelectHistory} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-blue-900 uppercase">Certified Tool</h3>
                <p className="text-[10px] text-blue-800 leading-relaxed mt-1">
                  Results for decision support only. Consult an agronomist for prescriptions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Clean Light Background */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
