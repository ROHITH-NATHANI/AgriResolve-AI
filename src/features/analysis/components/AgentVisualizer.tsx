import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, ShieldCheck, Scale, FileText, Activity, Zap } from 'lucide-react';
import { AssessmentStatus } from '../../../types';
import { cn } from '../../../lib/utils';

interface AgentVisualizerProps {
    status: AssessmentStatus;
}

const AGENTS = [
    {
        id: AssessmentStatus.PERCEIVING,
        label: "Vision Systems",
        icon: Eye,
        color: "bg-blue-500",
        desc: "Scanning visual features..."
    },
    {
        id: AssessmentStatus.EVALUATING,
        label: "Quality Control",
        icon: ShieldCheck,
        color: "bg-purple-500",
        desc: "Verifying image integrity..."
    },
    {
        id: AssessmentStatus.DEBATING,
        label: "Hypothesis Debate",
        icon: Brain,
        color: "bg-orange-500",
        desc: "Generative adversarial analysis..."
    },
    {
        id: AssessmentStatus.ARBITRATING,
        label: "Arbitration",
        icon: Scale,
        color: "bg-red-500",
        desc: "Weighing evidence & conflicts..."
    },
    {
        id: AssessmentStatus.EXPLAINING,
        label: "Explanation",
        icon: FileText,
        color: "bg-green-500",
        desc: "Synthesizing farmer guidance..."
    }
];

// Helper to map current status to active index
const getActiveIndex = (status: AssessmentStatus) => {
    const order = [
        AssessmentStatus.IDLE,
        AssessmentStatus.UPLOADING,
        AssessmentStatus.PERCEIVING,
        AssessmentStatus.EVALUATING,
        AssessmentStatus.DEBATING,
        AssessmentStatus.ARBITRATING,
        AssessmentStatus.EXPLAINING,
        AssessmentStatus.COMPLETED
    ];
    // Map IDLE/UPLOADING to 0 (before first agent), others to their index
    // The visualizer starts at PERCEIVING (index 2 in order array)
    // So we need to shift logic slightly or just use indexOf
    return order.indexOf(status) - 1; // -1 because IDLE/UPLOADING are before the first visual step?
    // Actually, let's keep it simple. The component expects 1-based index roughly.
    // If status is PERCEIVING (index 2), we want activeIndex to match the first agent (index 0 in AGENTS).
    // Let's rewrite the return to be clearer.
};

export const AgentVisualizer: React.FC<AgentVisualizerProps> = ({ status }) => {
    const activeIndex = getActiveIndex(status);

    if (status === AssessmentStatus.IDLE || status === AssessmentStatus.UPLOADING) return null;

    return (
        <div className="w-full max-w-4xl mx-auto my-8 p-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl overflow-hidden relative">
            {/* Background Grid Animation */}
            <div className="absolute inset-0 z-0 opacity-10">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            </div>

            <div className="relative z-10 flex justify-between items-center gap-4">
                {AGENTS.map((agent, index) => {
                    const isActive = index + 1 === activeIndex; // +1 because PENDING is 0
                    const isCompleted = index + 1 < activeIndex;

                    return (
                        <div key={agent.label} className="flex flex-col items-center gap-3 flex-1">
                            {/* Connection Line */}
                            {index < AGENTS.length - 1 && (
                                <div className="absolute top-10 left-[calc(10%_+_4rem)] w-[calc(20%_-_2rem)] h-0.5 bg-gray-700/30 -z-10">
                                    <motion.div
                                        className="h-full bg-green-400"
                                        initial={{ width: "0%" }}
                                        animate={{ width: isCompleted ? "100%" : "0%" }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            )}

                            {/* Icon Circle */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0.5 }}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    opacity: isActive || isCompleted ? 1 : 0.5,
                                    boxShadow: isActive ? "0 0 20px 2px rgba(34, 197, 94, 0.4)" : "none"
                                }}
                                className={cn(
                                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300",
                                    isActive ? agent.color : isCompleted ? "bg-green-600" : "bg-gray-800"
                                )}
                            >
                                <agent.icon className="w-8 h-8 text-white" />

                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 rounded-2xl border-2 border-white/50"
                                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    />
                                )}
                            </motion.div>

                            {/* Label */}
                            <div className="text-center">
                                <p className={cn(
                                    "text-xs font-bold uppercase tracking-wider mb-1",
                                    isActive ? "text-green-400" : isCompleted ? "text-green-600" : "text-gray-500"
                                )}>
                                    {agent.label}
                                </p>
                                {isActive && (
                                    <motion.p
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-[10px] text-gray-400 font-mono"
                                    >
                                        {agent.desc}
                                    </motion.p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Activity Pulse */}
            {status !== AssessmentStatus.COMPLETED && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="text-xs font-mono text-green-400 animate-pulse">SYSTEM ACTIVE</span>
                    <Activity className="w-4 h-4 text-green-400 animate-spin-slow" />
                </div>
            )}
        </div>
    );
};
