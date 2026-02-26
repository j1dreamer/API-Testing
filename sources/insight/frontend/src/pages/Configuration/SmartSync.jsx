import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import styles from './Cloner.module.css';
import { useLanguage } from '../../context/LanguageContext';
import {
    Activity, Shield, Rocket, Server, Sliders, CheckCircle, Wifi, Search, XCircle, Lock, Network
} from 'lucide-react';

const SmartSync = () => {
    const { t } = useLanguage();

    // --- 1. Quản lý State ---
    const [currentStep, setCurrentStep] = useState(1);
    const [liveSites, setLiveSites] = useState([]);

    // Step 1: Scope & Target
    const [selectedAction, setSelectedAction] = useState('update_ssid_password');
    const [searchTargetTerm, setSearchTargetTerm] = useState('');
    const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());

    // Step 2: Analysis & Configuration
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [compiledSSIDs, setCompiledSSIDs] = useState([]); // Unique SSIDs across selected sites
    const [selectedSSIDName, setSelectedSSIDName] = useState(''); // We use name instead of ID for cross-site matching
    const [newPassword, setNewPassword] = useState('');

    // State for Config Sync Mode
    const [selectedSourceSiteId, setSelectedSourceSiteId] = useState('');
    const [sourceSSIDs, setSourceSSIDs] = useState([]);
    const [isLoadingSourceSSIDs, setIsLoadingSourceSSIDs] = useState(false);

    // Step 3: Execution
    const [executionLoading, setExecutionLoading] = useState(false);
    const [executionResult, setExecutionResult] = useState(null);

    // --- 2. Khởi tạo ---
    useEffect(() => {
        loadLiveSites();
    }, []);

    const loadLiveSites = async () => {
        try {
            const res = await apiClient.get('/cloner/live-sites');
            if (Array.isArray(res.data)) {
                setLiveSites(res.data.sort((a, b) => a.siteName.localeCompare(b.siteName)));
            } else {
                setLiveSites([]);
            }
        } catch (error) {
            console.error(error);
            setLiveSites([]);
        }
    };

    const getRoleBadgeInfo = (roleStr) => {
        const role = (roleStr || 'UNKNOWN').toLowerCase();
        switch (role) {
            case 'administrator':
                return { text: 'ADMINISTRATOR', classes: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50', canClone: true };
            case 'operator':
                return { text: 'OPERATOR', classes: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50', canClone: true };
            case 'delegate':
                return { text: 'DELEGATE', classes: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50', canClone: false };
            case 'viewer':
                return { text: 'VIEWER', classes: 'bg-slate-200 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600/50', canClone: false };
            default:
                return { text: role.toUpperCase(), classes: 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-700/50', canClone: false };
        }
    };

    // Auto-reset down-stream steps if Step 1 changes
    useEffect(() => {
        if (currentStep > 1) {
            setHasAnalyzed(false);
            setCurrentStep(1);
            setExecutionResult(null);
            setCompiledSSIDs([]);
            setSelectedSSIDName('');
            setSelectedSourceSiteId('');
            setSourceSSIDs([]);
            setNewPassword('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTargetIds, selectedAction]);

    // Fetch SSIDs of Source Site if action is deep config sync
    useEffect(() => {
        setSourceSSIDs([]);
        if (!selectedSourceSiteId) return;

        const fetchSourceSSIDs = async () => {
            try {
                setIsLoadingSourceSSIDs(true);
                const res = await apiClient.get(`/cloner/sites/${selectedSourceSiteId}/ssids`);
                setSourceSSIDs(res.data || []);
            } catch (e) {
                console.error("Failed to fetch source SSIDs", e);
            } finally {
                setIsLoadingSourceSSIDs(false);
            }
        };
        fetchSourceSSIDs();
    }, [selectedSourceSiteId]);

    // --- 3. Logic xử lý API ---
    const handleAnalyzeSites = async () => {
        if (selectedTargetIds.size === 0) return alert("Vui lòng chọn ít nhất 1 Site.");

        setIsAnalyzing(true);
        setCompiledSSIDs([]);
        setSelectedSSIDName('');
        setSelectedSourceSiteId('');

        try {
            // Fetch SSIDs from all selected sites concurrently
            const siteIds = Array.from(selectedTargetIds);
            const fetchPromises = siteIds.map(siteId => apiClient.get(`/cloner/sites/${siteId}/ssids`).catch(() => ({ data: [] })));
            const responses = await Promise.all(fetchPromises);

            // Compile unique SSIDs by networkName
            const uniqueSSIDMap = new Map();
            responses.forEach(res => {
                const ssids = res.data || [];
                ssids.forEach(ssid => {
                    if (!uniqueSSIDMap.has(ssid.networkName)) {
                        uniqueSSIDMap.set(ssid.networkName, {
                            networkName: ssid.networkName,
                            security: ssid.security,
                            isGuestPortalEnabled: ssid.isGuestPortalEnabled,
                            foundInSites: 1
                        });
                    } else {
                        uniqueSSIDMap.get(ssid.networkName).foundInSites += 1;
                    }
                });
            });

            // Convert to array and sort
            const compiledList = Array.from(uniqueSSIDMap.values()).sort((a, b) => a.networkName.localeCompare(b.networkName));
            setCompiledSSIDs(compiledList);
            setHasAnalyzed(true);
            setCurrentStep(2);

        } catch (e) {
            console.error("Error analyzing sites", e);
            alert("Đã xảy ra lỗi khi phân tích các Sites");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleProceedToExecution = () => {
        if (!selectedSSIDName) return alert("Vui lòng chọn một SSID.");

        if (selectedAction === 'update_ssid_password') {
            const selectedSSID = compiledSSIDs.find(s => s.networkName === selectedSSIDName);
            if (selectedSSID && selectedSSID.isGuestPortalEnabled) {
                return alert("Không thể đổi mật khẩu cho Guest Portal SSID.");
            }
            if (!newPassword || newPassword.length < 8) return alert("Mật khẩu phải từ 8 ký tự trở lên.");
        } else if (selectedAction === 'update_ssid_config') {
            if (!selectedSourceSiteId) return alert("Vui lòng chọn Origin Site.");
        } else if (selectedAction === 'delete_ssid') {
            // Nothing extra to validate for delete_ssid except selectedSSIDName
        }

        setCurrentStep(3);
    };

    const handleExecuteSync = async () => {
        if (selectedTargetIds.size === 0 || !selectedSSIDName) return;

        let confirmMsg = `Xác nhận cập nhật cho SSID "${selectedSSIDName}" trên ${selectedTargetIds.size} sites?`;
        if (selectedAction === 'delete_ssid') {
            confirmMsg = `⚠️ CẢNH BÁO NGUY HIỂM ⚠️\nBạn có chắc chắn muốn XÓA SSID "${selectedSSIDName}" trên ${selectedTargetIds.size} sites không?\nHành động này không thể hoàn tác!`;
        }

        if (!confirm(confirmMsg)) return;

        setExecutionLoading(true);
        setExecutionResult(null);
        try {
            let res;
            if (selectedAction === 'update_ssid_password') {
                const payload = {
                    source_network_name: selectedSSIDName,
                    new_password: newPassword,
                    target_site_ids: Array.from(selectedTargetIds)
                };
                res = await apiClient.post('/cloner/sync-password', payload);
            } else if (selectedAction === 'update_ssid_config') {
                const payload = {
                    source_site_id: selectedSourceSiteId,
                    source_network_name: selectedSSIDName,
                    target_site_ids: Array.from(selectedTargetIds)
                };
                res = await apiClient.post('/cloner/sync-config', payload);
            } else if (selectedAction === 'delete_ssid') {
                const payload = {
                    source_network_name: selectedSSIDName,
                    target_site_ids: Array.from(selectedTargetIds)
                };
                res = await apiClient.post('/cloner/sync-delete', payload);
            }

            if (res?.data?.status === 'success') {
                // Combine existing sites info with execution results
                const resultsWithSiteInfo = res.data.results.map(er => {
                    const siteInfo = liveSites.find(s => s.siteId === er.target);
                    return {
                        ...er,
                        siteName: siteInfo ? siteInfo.siteName : er.target
                    };
                });
                // Sort by status: Error first, then Skipped, then Success
                const sortedResults = resultsWithSiteInfo.sort((a, b) => {
                    const order = { 'ERROR': 1, 'SKIPPED': 2, 'SUCCESS': 3 };
                    return (order[a.status] || 99) - (order[b.status] || 99);
                });
                setExecutionResult(sortedResults);
            }
        } catch (error) {
            alert("Lỗi thực thi: " + (error.response?.data?.detail || error.message));
        } finally {
            setExecutionLoading(false);
        }
    };

    // --- 4. Giao diện ---
    return (
        <div className={`relative w-full min-h-[800px] h-full bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 font-sans overflow-x-hidden rounded-xl border border-slate-200 dark:border-gray-800 shadow-xl dark:shadow-2xl ${styles.clonerWrapper}`}>
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none rounded-xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/5 dark:bg-emerald-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/5 dark:bg-teal-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-10 w-full h-full p-8 space-y-12">
                {/* Horizontal Progress Stepper */}
                <div className="bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl py-6 border-b border-slate-200 dark:border-white/5 -mx-8 px-12 mb-10 transition-all duration-300">
                    <div className="max-w-4xl mx-auto relative px-4">
                        <div className="flex justify-between items-center relative z-10">
                            {['Scope & Target', 'Filter & Config', 'Execution Log'].map((step, idx) => {
                                const stepNum = idx + 1;
                                const isActive = currentStep >= stepNum;
                                const isCurrent = currentStep === stepNum;
                                return (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border ${isCurrent ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-110 text-white' :
                                            isActive ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-500/50 text-emerald-500 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-700'
                                            }`}>
                                            {isActive && !isCurrent ? <CheckCircle size={20} /> :
                                                idx === 0 ? <Server size={20} /> :
                                                    idx === 1 ? <Sliders size={20} /> : <Rocket size={20} />}
                                        </div>
                                        <span className={`mt-3 text-[9px] font-black uppercase tracking-[0.2em] ${isCurrent ? 'text-emerald-700 dark:text-white' : 'text-slate-500 dark:text-slate-600'}`}>
                                            {step}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="absolute top-6 left-0 w-full h-[2px] bg-slate-200 dark:bg-white/5 -z-0"></div>
                        <div
                            className="absolute top-6 left-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-600 dark:to-teal-500 -z-0 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)] dark:shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 gap-12 max-w-6xl mx-auto">

                    {/* Step 1: Scope & Target */}
                    <section className={`relative transition-all duration-700 ${currentStep > 1 ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                        <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-10 shadow-xl dark:shadow-2xl">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                    <Wifi size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Smart Synchronization</h2>
                                    <p className="text-sm text-slate-500">Targeted functionality updates across multiple sites.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Action */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">1. Select Action Type</label>
                                        <select
                                            value={selectedAction}
                                            onChange={e => setSelectedAction(e.target.value)}
                                            className="w-full h-16 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-slate-800 dark:text-white text-lg font-bold appearance-none focus:outline-none focus:border-emerald-500/50"
                                        >
                                            <option value="update_ssid_password">Update Wireless PSK</option>
                                            <option value="update_ssid_config">Update Deep SSID Config</option>
                                            <option value="delete_ssid">Delete SSID Multi-Site</option>
                                        </select>
                                    </div>
                                    <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl">
                                        <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                                            Chọn các <strong>Sites</strong> mà bạn muốn chèn cấu hình ở cột bên cạnh, sau đó bấm <strong>Analyze</strong> để phân tích thông tin trước khi thực thi.
                                        </p>
                                    </div>
                                </div>

                                {/* Right Column: Target Sites */}
                                <div className="lg:col-span-2 flex flex-col h-[500px]">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex justify-between">
                                        <span>2. Search & Select Target Sites</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">Selected: {selectedTargetIds.size}</span>
                                    </label>
                                    <div className="relative mb-4 shrink-0">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={16} className="text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search sites..."
                                            value={searchTargetTerm}
                                            onChange={(e) => setSearchTargetTerm(e.target.value)}
                                            className="w-full text-sm bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        />
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl p-2 bg-slate-50/50 dark:bg-black/20">
                                        {liveSites.filter(res => res.siteName.toLowerCase().includes(searchTargetTerm.toLowerCase())).map((site) => {
                                            const roleInfo = getRoleBadgeInfo(site.role);
                                            const isSelected = selectedTargetIds.has(site.siteId);
                                            const canSelect = roleInfo.canClone;

                                            let labelClass = 'bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 hover:border-slate-300';
                                            if (isSelected) {
                                                labelClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 cursor-pointer shadow-sm';
                                            } else if (!canSelect) {
                                                labelClass = 'opacity-50 grayscale bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 cursor-not-allowed';
                                            } else {
                                                labelClass = 'bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 hover:border-slate-400 cursor-pointer';
                                            }

                                            return (
                                                <label key={site.siteId} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${labelClass}`}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{site.siteName}</span>
                                                                <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest shrink-0 ${roleInfo.classes}`}>
                                                                    {roleInfo.text}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-600 mt-0.5 truncate">{site.siteId}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-500/20' : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-black/50'}`}>
                                                            {isSelected && <div className="w-2 h-2 rounded-sm bg-emerald-500 dark:bg-emerald-400"></div>}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            disabled={!canSelect}
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const newSet = new Set(selectedTargetIds);
                                                                if (e.target.checked) newSet.add(site.siteId);
                                                                else newSet.delete(site.siteId);
                                                                setSelectedTargetIds(newSet);
                                                            }}
                                                            className="hidden"
                                                        />
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => {
                                                const validSites = liveSites.filter(s => getRoleBadgeInfo(s.role).canClone).map(s => s.siteId);
                                                if (selectedTargetIds.size === validSites.length && validSites.length > 0) {
                                                    setSelectedTargetIds(new Set());
                                                } else {
                                                    setSelectedTargetIds(new Set(validSites));
                                                }
                                            }}
                                            className="px-4 py-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                                        >
                                            {selectedTargetIds.size > 0 ? "Deselect All" : "Select All Valid"}
                                        </button>
                                        <button
                                            onClick={handleAnalyzeSites}
                                            disabled={isAnalyzing || selectedTargetIds.size === 0}
                                            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
                                        >
                                            {isAnalyzing ? (
                                                <><div className="w-4 h-4 rounded-full border-2 border-white/50 border-t-transparent animate-spin"></div> Scanning Data...</>
                                            ) : (
                                                <><Search size={16} /> Analyze Selected</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Step 2: Filter & Config */}
                    {hasAnalyzed && (
                        <section className={`transition-all duration-700 animate-fade-in ${currentStep > 2 ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-10 shadow-xl dark:shadow-2xl">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 mb-8 flex items-center gap-2">
                                    <Sliders size={16} className="text-blue-500" /> Parameter Configuration
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                    {selectedAction === 'update_ssid_password' || selectedAction === 'delete_ssid' ? (
                                        <>
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">3. Select Target Network (SSID)</label>
                                                    <select
                                                        value={selectedSSIDName}
                                                        onChange={e => setSelectedSSIDName(e.target.value)}
                                                        className="w-full h-14 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-slate-800 dark:text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50"
                                                    >
                                                        <option value="">-- Choose Analyzed SSID --</option>
                                                        {compiledSSIDs.map(ssid => {
                                                            const isDisabled = selectedAction === 'update_ssid_password' && ssid.isGuestPortalEnabled;
                                                            return (
                                                                <option
                                                                    key={ssid.networkName}
                                                                    value={ssid.networkName}
                                                                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 disabled:opacity-50 disabled:bg-slate-100"
                                                                    disabled={isDisabled}
                                                                >
                                                                    {ssid.networkName} (Found in {ssid.foundInSites} site{ssid.foundInSites > 1 ? 's' : ''}) {isDisabled ? '[GUEST - Password Update Not Supported]' : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            </div>

                                            {selectedAction === 'update_ssid_password' && (
                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                                            <Lock size={12} className="text-slate-400" /> 4. New Configuration (Password)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-white dark:bg-black/60 border border-slate-200 dark:border-white/10 rounded-2xl px-6 h-14 text-lg font-mono focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                                            placeholder="Enter min 8 characters..."
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">3. Select Origin Site</label>
                                                    <select
                                                        value={selectedSourceSiteId}
                                                        onChange={e => {
                                                            setSelectedSourceSiteId(e.target.value);
                                                            setSelectedSSIDName('');
                                                        }}
                                                        className="w-full h-14 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-slate-800 dark:text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50"
                                                    >
                                                        <option value="">-- Choose Origin Site --</option>
                                                        {liveSites.map(site => (
                                                            <option key={site.siteId} value={site.siteId} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{site.siteName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex justify-between items-center">
                                                        <span>4. Select Source SSID to Clone From</span>
                                                        {isLoadingSourceSSIDs && <span className="text-emerald-500 animate-pulse capitalize">Loading...</span>}
                                                    </label>
                                                    <select
                                                        value={selectedSSIDName}
                                                        onChange={e => setSelectedSSIDName(e.target.value)}
                                                        disabled={!selectedSourceSiteId || isLoadingSourceSSIDs}
                                                        className="w-full h-14 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-slate-800 dark:text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                                                    >
                                                        <option value="">-- Choose Origin SSID --</option>
                                                        {sourceSSIDs.map(ssid => {
                                                            const existsInTarget = compiledSSIDs.some(s => s.networkName === ssid.networkName);
                                                            return (
                                                                <option
                                                                    key={ssid.networkId || ssid.networkName}
                                                                    value={ssid.networkName}
                                                                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                                                >
                                                                    {ssid.networkName} {existsInTarget ? `(Matches ${compiledSSIDs.find(s => s.networkName === ssid.networkName)?.foundInSites} targets)` : '(Will skip on targets)'}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
                                    <button
                                        onClick={() => setCurrentStep(1)}
                                        className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                                    >
                                        Back to Sites
                                    </button>
                                    <button
                                        onClick={handleProceedToExecution}
                                        disabled={selectedAction === 'update_ssid_password' ? (!selectedSSIDName || !newPassword || newPassword.length < 8) : selectedAction === 'delete_ssid' ? !selectedSSIDName : (!selectedSSIDName || !selectedSourceSiteId)}
                                        className="h-14 px-10 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black uppercase tracking-widest rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100"
                                    >
                                        Proceed to Deploy
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Step 3: Execution Log */}
                    {currentStep === 3 && (
                        <section className="transition-all duration-700 animate-fade-in pb-20">
                            <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-10 shadow-xl dark:shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <Activity size={16} className="text-emerald-500" /> Deployment Log
                                    </h3>
                                    <div className="flex gap-4">
                                        {!executionLoading && (
                                            <button
                                                onClick={() => setCurrentStep(2)}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors active:scale-95"
                                            >
                                                Back
                                            </button>
                                        )}
                                        {!executionResult && !executionLoading && (
                                            <button
                                                onClick={handleExecuteSync}
                                                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-rose-600/20 active:scale-95"
                                            >
                                                Confirm & Execute
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {executionLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-slate-100/50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5">
                                        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                        <p className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-sm animate-pulse">Running batch updates on {selectedTargetIds.size} sites...</p>
                                    </div>
                                )}

                                {executionResult && (
                                    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="bg-[#020617] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Server size={14} /> Console Output
                                            </span>
                                            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded">COMPLETED</span>
                                        </div>
                                        <div className="p-4 max-h-[500px] overflow-y-auto space-y-2 font-mono text-xs custom-scrollbar">
                                            {executionResult.map((log, index) => {
                                                let colorClass = 'text-slate-400';
                                                let bgClass = 'hover:bg-white/[0.02]';
                                                let icon = null;

                                                if (log.status === 'SUCCESS') {
                                                    colorClass = 'text-emerald-400';
                                                    bgClass = 'bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10';
                                                    icon = <CheckCircle size={14} className="inline mr-2" />;
                                                } else if (log.status === 'ERROR') {
                                                    colorClass = 'text-rose-400';
                                                    bgClass = 'bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10';
                                                    icon = <XCircle size={14} className="inline mr-2" />;
                                                } else if (log.status === 'SKIPPED') {
                                                    colorClass = 'text-amber-400/80';
                                                    bgClass = 'hover:bg-white/[0.02] border border-transparent';
                                                }

                                                return (
                                                    <div key={index} className={`p-3 rounded-xl flex flex-col md:flex-row md:items-center gap-2 md:gap-4 transition-all ${colorClass} ${bgClass}`}>
                                                        <div className="w-[200px] shrink-0 font-bold truncate tracking-wide" title={log.siteName}>
                                                            [{log.siteName}]
                                                        </div>
                                                        <div className="shrink-0 w-[90px] font-black tracking-widest">
                                                            {log.status}
                                                        </div>
                                                        <div className="text-slate-400 truncate flex-1 flex items-center opacity-80" title={log.detail}>
                                                            {icon} {log.detail}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div >
        </div >
    );
};

export default SmartSync;
