import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ScanLine, LayoutGrid, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const MobileBottomNav: React.FC = () => {
    const { t } = useTranslation();

    const navItems = [
        { to: "/", icon: LayoutGrid, label: t('nav_home', "Hub") },
        { to: "/diagnosis", icon: ScanLine, label: t('nav_scan', "Scanner") },
        { to: "/history", icon: Home, label: t('nav_history', "History") }, // Using Home icon as placeholder for now or History icon
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-inset-bottom">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `
              flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200
              ${isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600'}
            `}
                >
                    <item.icon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
};
