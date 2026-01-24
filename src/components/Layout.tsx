import React, { useState } from 'react';
import { HistorySidebar } from '../features/history/components/HistorySidebar';
import { CropAnalysisRecord } from '../features/history/types';
import { ShieldCheck, Plus, Sprout, Sun, RefreshCw, ChevronDown, ChevronRight, History, Menu, X } from 'lucide-react';
import { InsightsDashboard } from '../features/assistant/components/InsightsDashboard';
import { useLocationWeather } from '../features/assistant/hooks/useLocationWeather';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
  children: React.ReactNode;
  history?: CropAnalysisRecord[];
  onSelectHistory?: (record: CropAnalysisRecord) => void;
  onNewAnalysis?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, history = [], onSelectHistory = () => { }, onNewAnalysis }) => {
  const { t } = useTranslation();
  const { locationName, requestPermission, consent } = useLocationWeather();
  const [showHistory, setShowHistory] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dynamic Day Calculation (Mocked Start Date: Dec 1, 2025)
  const currentDayCount = React.useMemo(() => {
    const start = new Date('2025-12-01');
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-inter bg-gray-50">

      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center bg-green-50 rounded-lg border border-green-100">
            <img src="/logo.png" alt="AgriResolve AI Logo" className="w-6 h-6 object-contain" />
          </div>
          <h1 className="text-sm font-black text-gray-900 tracking-tight">AgriResolve AI</h1>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Drawer */}
      <aside className={`
          fixed md:sticky top-0 left-0 h-screen w-[280px] md:w-80 bg-white border-r border-gray-200 
          text-gray-900 flex flex-col shadow-2xl md:shadow-xl z-50 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* 1. Header & Identity */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-green-50 rounded-xl border border-green-100 shadow-sm">
              <img src="/logo.png" alt="AgriResolve AI Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight leading-tight">AgriResolve AI</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-bold text-green-700 tracking-widest uppercase">{t('online', { defaultValue: 'System Active' })}</span>
              </div>
            </div>
          </div>
          {/* Close Button for Mobile */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">

          {/* 2. Quick Actions */}
          <div className="p-4 grid grid-cols-2 gap-3">
            <button
              onClick={onNewAnalysis}
              className="col-span-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl shadow-lg shadow-green-900/10 transition-all active:scale-95 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold text-sm tracking-wide">{t('new_scan', { defaultValue: 'New Analysis' })}</span>
            </button>
          </div>

          {/* 3. Active Crop Card (Field Status) */}
          <div className="px-4 mb-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-green-200/50" />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest bg-white/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {t('active_season', { defaultValue: 'Active Season' })}
                  </span>
                  <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                    <Sun className="w-3 h-3 text-orange-500 animate-spin-slow" />
                    <span className="text-[10px] font-bold text-orange-700">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-0.5">Rabi 2026</h3>
                <p className="text-xs text-gray-500 font-medium mb-3 flex items-center gap-1">
                  <Sprout className="w-3 h-3" />
                  <span>Growth Stage: Vegetative</span>
                </p>

                <div className="w-full bg-white/50 h-1.5 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((currentDayCount / 120) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] font-medium text-gray-400">
                  <span>Sowing (Dec 1)</span>
                  <span className="text-green-600 font-bold">Day {currentDayCount}</span>
                  <span>Harvest</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Insights Dashboard (Pinned) */}
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {t('field_monitor', { defaultValue: 'Field Monitor' })}
              </h2>
              {consent !== 'granted' && (
                <button
                  onClick={() => requestPermission()}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Enable
                </button>
              )}
            </div>

            {consent === 'granted' && locationName?.displayName ? (
              <InsightsDashboard locationName={locationName.displayName} />
            ) : (
              <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <p className="text-xs text-gray-400 font-medium mb-2">{t('enable_loc_msg', { defaultValue: 'Enable location for local insights.' })}</p>
              </div>
            )}
          </div>

          {/* 5. History (Collapsible) */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200 group"
            >
              <div className="flex items-center gap-2 text-gray-500 group-hover:text-gray-700">
                <History className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('history_header')}</span>
              </div>
              {showHistory ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>

            {showHistory && (
              <div className="mt-2 pl-2 border-l-2 border-gray-100 animate-in slide-in-from-top-2 fade-in">
                <HistorySidebar
                  history={history}
                  onSelect={(r) => {
                    onSelectHistory(r);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 mt-auto">
          <div className="flex items-start gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <ShieldCheck className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                {t('disclaimer')}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative z-10 bg-gray-50 pt-20 md:pt-8 safe-area-inset-top">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};
