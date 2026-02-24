import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import styles from './Cloner.module.css';
import {
    ShieldCheck, Rocket, Download, Key, LayoutDashboard, CheckSquare, FileJson,
    ArrowRight, Server, Globe, Zap, Wifi, Cable, Users, CheckCircle, Activity, Code, Network
} from 'lucide-react';

const Cloner = () => {
    // --- 1. Quản lý State ---
    const [sourceMode, setSourceMode] = useState('captured');
    const [sourceSites, setSourceSites] = useState([]);
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [fetchLoading, setFetchLoading] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const [previewOps, setPreviewOps] = useState([]);
    const [selectedOpsIndices, setSelectedOpsIndices] = useState(new Set());
    const [showPreview, setShowPreview] = useState(false);

    const [targetSites, setTargetSites] = useState([]);
    const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());
    const [executionLoading, setExecutionLoading] = useState(false);
    const [executionResult, setExecutionResult] = useState(null);

    const [modalData, setModalData] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);

    // --- 2. Khởi tạo & Đồng bộ hóa ---
    useEffect(() => {
        loadSourceSites(sourceMode);
        loadTargetSites();
    }, []);

    useEffect(() => {
        loadSourceSites(sourceMode);
        setSelectedSourceId('');
        setShowPreview(false);
    }, [sourceMode]);

    useEffect(() => {
        if (executionResult) setCurrentStep(3);
        else if (showPreview) setCurrentStep(2);
        else setCurrentStep(1);
    }, [showPreview, executionResult]);

    // --- 3. Các hàm Logic xử lý API ---

    const loadSourceSites = async (mode) => {
        try {
            const endpoint = mode === 'live' ? '/cloner/live-sites' : '/cloner/sites';
            const res = await apiClient.get(endpoint);
            setSourceSites(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            if (mode === 'live') setSourceSites([]);
        }
    };

    const loadTargetSites = async () => {
        try {
            const res = await apiClient.get('/cloner/target-sites');
            setTargetSites(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to load target sites:", error);
        }
    };

    const handleFetchConfig = async () => {
        if (!selectedSourceId) return;
        setFetchLoading(true);
        setFetchError('');
        try {
            const res = await apiClient.post('/cloner/preview', {
                site_id: selectedSourceId,
                source: sourceMode
            });
            const ops = Array.isArray(res.data?.operations) ? res.data.operations : [];
            setPreviewOps(ops);
            setSelectedOpsIndices(new Set(ops.map((_, i) => i)));
            setShowPreview(true);
        } catch (error) {
            setFetchError(error.response?.data?.detail || "Lỗi khi lấy cấu hình.");
        } finally {
            setFetchLoading(false);
        }
    };

    const handleExecuteClone = async () => {
        if (selectedTargetIds.size === 0) return alert("Vui lòng chọn ít nhất 1 Site đích.");
        const opsToRun = previewOps.filter((_, i) => selectedOpsIndices.has(i));
        if (!confirm(`Xác nhận áp dụng ${opsToRun.length} lệnh?`)) return;

        setExecutionLoading(true);
        try {
            const res = await apiClient.post('/cloner/apply', {
                target_site_ids: Array.from(selectedTargetIds),
                operations: opsToRun
            });
            setExecutionResult(res.data);
        } catch (error) {
            alert("Lỗi thực thi: " + (error.response?.data?.detail || error.message));
        } finally {
            setExecutionLoading(false);
        }
    };

    const toggleSetItem = (setObj, item) => {
        const newSet = new Set(setObj);
        if (newSet.has(item)) newSet.delete(item);
        else newSet.add(item);
        return newSet;
    };

    const getOpIcon = (type) => {
        if (type.includes('WIRELESS')) return <Wifi size={16} className="text-[#ff8300]" />;
        if (type.includes('WIRED')) return <Cable size={16} className="text-blue-400" />;
        if (type.includes('GUEST')) return <Users size={16} className="text-emerald-400" />;
        return <Activity size={16} className="text-slate-400" />;
    };

    // --- 4. Giao diện ---
    return (
        <div className={`relative w-full min-h-[800px] h-full bg-[#020617] text-slate-200 font-sans overflow-x-hidden rounded-xl border border-gray-800 shadow-2xl ${styles.clonerWrapper}`}>
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none rounded-xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-10 w-full h-full p-8 space-y-12">
                {/* Horizontal Progress Stepper */}
                <div className="bg-[#020617]/80 backdrop-blur-xl py-6 border-b border-white/5 -mx-8 px-12 mb-10 transition-all duration-300">
                    <div className="max-w-4xl mx-auto relative px-4">
                        <div className="flex justify-between items-center relative z-10">
                            {['Source', 'Review', 'Execute'].map((step, idx) => {
                                const stepNum = idx + 1;
                                const isActive = currentStep >= stepNum;
                                const isCurrent = currentStep === stepNum;
                                return (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border ${isCurrent ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-110 text-white' :
                                            isActive ? 'bg-slate-900 border-blue-500/50 text-blue-400' : 'bg-slate-950 border-white/5 text-slate-700'
                                            }`}>
                                            {isActive && !isCurrent ? <CheckCircle size={20} /> :
                                                idx === 0 ? <Server size={20} /> :
                                                    idx === 1 ? <CheckSquare size={20} /> : <Rocket size={20} />}
                                        </div>
                                        <span className={`mt-3 text-[9px] font-black uppercase tracking-[0.2em] ${isCurrent ? 'text-white' : 'text-slate-600'}`}>
                                            {step}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="absolute top-6 left-0 w-full h-[2px] bg-white/5 -z-0"></div>
                        <div
                            className="absolute top-6 left-0 h-[2px] bg-gradient-to-r from-blue-600 to-cyan-500 -z-0 transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 gap-12 max-w-6xl mx-auto">
                    {/* Step 1: Source Selection */}
                    <section className={`relative transition-all duration-700 ${currentStep > 1 ? 'opacity-40 blur-[1px]' : ''}`}>
                        <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-10 shadow-2xl">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                    <Download size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Configuration Source</h2>
                                    <p className="text-sm text-slate-500">Select the blueprint data for migration</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                                <div className="lg:col-span-4 flex flex-col gap-4">
                                    <button
                                        onClick={() => setSourceMode('captured')}
                                        className={`p-6 rounded-2xl border transition-all text-left flex items-center gap-4 ${sourceMode === 'captured' ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-white' : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'}`}
                                    >
                                        <FileJson size={24} />
                                        <div className="flex flex-col">
                                            <span className="font-bold uppercase tracking-widest text-xs">Captured Logs</span>
                                            <span className="text-[10px] opacity-60 font-medium italic">Local Archive</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setSourceMode('live')}
                                        className={`p-6 rounded-2xl border transition-all text-left flex items-center gap-4 ${sourceMode === 'live' ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)] text-white' : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'}`}
                                    >
                                        <Globe size={24} />
                                        <div className="flex flex-col">
                                            <span className="font-bold uppercase tracking-widest text-xs">Live Cloud</span>
                                            <span className="text-[10px] opacity-60 font-medium italic">Direct API Fetch</span>
                                        </div>
                                    </button>
                                </div>

                                <div className="lg:col-span-8 flex flex-col gap-6">
                                    <div className="relative">
                                        <select
                                            value={selectedSourceId}
                                            onChange={e => setSelectedSourceId(e.target.value)}
                                            className="w-full h-16 bg-black/40 border border-white/5 rounded-2xl px-6 text-white text-lg font-bold appearance-none focus:outline-none focus:border-blue-500/50"
                                        >
                                            <option value="">-- Choose Origin Site --</option>
                                            {sourceSites.map(site => (
                                                <option key={site.siteId} value={site.siteId} className="bg-slate-900">{site.siteName}</option>
                                            ))}
                                        </select>
                                        <ArrowRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 rotate-90" size={20} />
                                    </div>
                                    <button
                                        onClick={handleFetchConfig}
                                        disabled={!selectedSourceId || fetchLoading}
                                        className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-30"
                                    >
                                        {fetchLoading ? 'Decoding Topology...' : 'Inspect Site Configuration'}
                                    </button>
                                    {fetchError && <p className="text-rose-500 text-xs font-bold text-center italic">{fetchError}</p>}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Step 2: Review & Execution */}
                    {showPreview && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in pb-20">

                            {/* Operation Preview List */}
                            <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col max-h-[550px]">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                                        <Activity size={16} className="text-blue-500" /> Blueprint Elements
                                    </h3>
                                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-black border border-blue-500/20">{previewOps.length} DETECTED</span>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                                    {previewOps.map((op, idx) => (
                                        <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/20 transition-all">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOpsIndices.has(idx)}
                                                    onChange={() => setSelectedOpsIndices(prev => toggleSetItem(prev, idx))}
                                                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-blue-600 focus:ring-0"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {getOpIcon(op.type)}
                                                        <span className="text-sm font-bold text-white">{op.name}</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">{op.type}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setModalData(op)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-all">
                                                <Code size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Target Selection & Action */}
                            <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col max-h-[550px]">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-2">
                                    <Network size={16} className="text-emerald-500" /> Target Deployment
                                </h3>
                                <div className="flex-1 overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                                    {targetSites.map(site => (
                                        <label key={site.siteId} className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${selectedTargetIds.has(site.siteId) ? 'bg-emerald-600/10 border-emerald-500/50' : 'bg-black/40 border-white/5 hover:border-white/10'}`}>
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${selectedTargetIds.has(site.siteId) ? 'text-emerald-400' : 'text-slate-400'}`}>{site.siteName}</span>
                                                <span className="text-[9px] font-mono text-slate-700">{site.siteId}</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={selectedTargetIds.has(site.siteId)}
                                                onChange={() => setSelectedTargetIds(prev => toggleSetItem(prev, site.siteId))}
                                                className="w-6 h-6 rounded-full border-white/10 bg-white/5 text-emerald-500 focus:ring-0"
                                            />
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-8">
                                    <button
                                        onClick={handleExecuteClone}
                                        disabled={executionLoading || selectedTargetIds.size === 0}
                                        className="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20"
                                    >
                                        {executionLoading ? 'Deploying...' : 'Initiate Migration'}
                                    </button>
                                </div>
                                {executionResult && (
                                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-2"><CheckCircle size={14} /> MIGRATION COMPLETED SUCCESSFULLY</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: JSON Inspector */}
            {modalData && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md animate-fade-in rounded-xl">
                    <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col scale-in-center">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Code size={16} /> Payload Inspector</span>
                            <button onClick={() => setModalData(null)} className="text-xs font-bold text-slate-500 hover:text-white transition-colors">Close</button>
                        </div>
                        <div className="flex-1 p-8 bg-black/40 overflow-auto font-mono text-[11px] text-blue-300 leading-relaxed custom-scrollbar max-h-[65vh]">
                            <pre>{JSON.stringify(modalData.payload, null, 2)}</pre>
                        </div>
                        <div className="p-6 bg-slate-900 border-t border-white/5 flex justify-end">
                            <button onClick={() => setModalData(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded-lg transition-all">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cloner;
