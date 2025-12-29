import React from 'react';
import { useTranslation } from 'react-i18next';
import { CropAnalysisRecord } from '../types';

interface HistorySidebarProps {
    history: CropAnalysisRecord[];
    onSelect: (record: CropAnalysisRecord) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect }) => {
    const { t, i18n } = useTranslation();

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">{t('no_history', 'No recent analysis records')}</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {history.map((record) => (
                            <button
                                key={record.id}
                                onClick={() => onSelect(record)}
                                className="w-full text-left p-2.5 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all duration-150 group flex items-start gap-3"
                            >
                                <div className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-bold text-[10px] border ${record.healthStatus === 'healthy' ? 'bg-green-50 text-green-700 border-green-200' :
                                    record.healthStatus === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>
                                    {record.healthStatus === 'healthy' ? '✓' : '!'}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                                        {record.diagnosis.primaryIssue || t('unknown_issue')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gray-500 font-mono">
                                            {new Date(record.timestamp).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
