import React from 'react';
import { motion } from 'framer-motion';

export const ScanOverlay: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    if (!isActive) return null;

    return (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
            {/* Laser Line */}
            <motion.div
                className="h-1 w-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]"
                initial={{ top: "0%" }}
                animate={{ top: "100%" }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                    repeatType: "reverse"
                }}
            />

            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

            {/* Corner Brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-400 rounded-br-lg" />

            {/* Analyzing Text */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-green-500/30">
                <p className="text-green-400 text-xs font-mono animate-pulse">
                    ANALYZING BIOMETRICS...
                </p>
            </div>
        </div>
    );
};
