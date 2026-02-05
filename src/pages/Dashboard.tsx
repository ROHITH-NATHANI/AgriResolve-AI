import React from 'react';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Box, Sprout, TrendingUp, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const apps = [
        {
            id: 'scanner',
            title: t('app_scanner_title', 'Crop Scanner'),
            desc: t('app_scanner_desc', 'AI-powered disease diagnosis'),
            icon: ScanLine,
            color: 'bg-green-100 text-green-600',
            action: () => navigate('/diagnosis'),
            status: 'Active'
        },
        {
            id: 'agritwin',
            title: t('app_agritwin_title', 'Agri-Twin'),
            desc: t('app_agritwin_desc', 'Risk-free farming simulator'),
            icon: Box,
            color: 'bg-blue-100 text-blue-600',
            action: () => { }, // Placeholder
            status: 'Coming Soon'
        },
        {
            id: 'bioprospector',
            title: t('app_bio_title', 'Bio-Prospector'),
            desc: t('app_bio_desc', 'Discover hidden value in weeds'),
            icon: Sprout,
            color: 'bg-purple-100 text-purple-600',
            action: () => { }, // Placeholder
            status: 'Coming Soon'
        },
        {
            id: 'market',
            title: t('app_market_title', 'Market Pulse'),
            desc: t('app_market_desc', 'Real-time prices & cooperative selling'),
            icon: TrendingUp,
            color: 'bg-orange-100 text-orange-600',
            action: () => { }, // Placeholder
            status: 'Coming Soon'
        }
    ];

    return (
        <Layout onNewAnalysis={() => navigate('/diagnosis')}>
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-3xl p-8 text-white shadow-xl">
                    <h1 className="text-3xl font-black mb-2">{t('dashboard_welcome', 'Welcome, Farmer')}</h1>
                    <p className="text-green-100 font-medium max-w-lg">
                        {t('dashboard_subtitle', 'Your integrated command center for farm management, resilience, and growth.')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {apps.map((app) => (
                        <div
                            key={app.id}
                            onClick={app.action}
                            className={`
                                relative p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group
                                ${app.status === 'Coming Soon' ? 'opacity-70 grayscale-[0.5]' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${app.color}`}>
                                    <app.icon className="w-6 h-6" />
                                </div>
                                {app.status === 'Coming Soon' && (
                                    <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                        Coming Soon
                                    </span>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1">{app.title}</h3>
                            <p className="text-sm text-gray-500 font-medium mb-4">{app.desc}</p>

                            {app.status === 'Active' && (
                                <div className="flex items-center text-green-600 text-sm font-bold group-hover:gap-2 transition-all">
                                    {t('open_app', 'Open App')} <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
};
