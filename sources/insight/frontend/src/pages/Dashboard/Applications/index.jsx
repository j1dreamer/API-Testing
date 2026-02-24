import React from 'react';
import { Box, PieChart as PieIcon, BarChart as BarIcon, Activity, Lock, ExternalLink, ShieldCheck } from 'lucide-react';

const Applications = () => {
    return (
        <div className="p-8 pb-32">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-white tracking-tight">Applications</h1>
                <p className="text-sm text-slate-400 mt-1">Traffic analysis and classification</p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-12 border border-white/5 flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mb-8 shadow-inner animate-pulse">
                    <Box size={48} />
                </div>
                <h2 className="text-2xl font-black text-white mb-4 italic uppercase tracking-tighter">Traffic Explorer</h2>
                <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
                    Application tracking requires Deep Packet Inspection (DPI) to be enabled on your Aruba gateways and APs.
                    DPI data is currently being synthesized for this visualization.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-40">
                    <div className="bg-black/40 border border-white/5 p-6 rounded-2xl flex flex-col items-center">
                        <PieIcon size={32} className="text-orange-400 mb-4" />
                        <div className="h-2 w-24 bg-slate-800 rounded-full mb-2"></div>
                        <div className="h-2 w-16 bg-slate-800 rounded-full"></div>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-6 rounded-2xl flex flex-col items-center">
                        <BarIcon size={32} className="text-blue-400 mb-4" />
                        <div className="h-2 w-24 bg-slate-800 rounded-full mb-2"></div>
                        <div className="h-2 w-16 bg-slate-800 rounded-full"></div>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-6 rounded-2xl flex flex-col items-center">
                        <Activity size={32} className="text-emerald-400 mb-4" />
                        <div className="h-2 w-24 bg-slate-800 rounded-full mb-2"></div>
                        <div className="h-2 w-16 bg-slate-800 rounded-full"></div>
                    </div>
                </div>

                <div className="mt-12 flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-slate-300">
                    <Lock size={14} className="text-orange-500" />
                    <span>UPGRADE TO ADVANCED ANALYTICS TO ENABLE FULL DPI</span>
                    <ExternalLink size={14} className="opacity-50" />
                </div>
            </div>
        </div>
    );
};

export default Applications;
