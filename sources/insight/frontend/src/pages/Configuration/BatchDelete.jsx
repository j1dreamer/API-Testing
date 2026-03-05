import React, { useState, useRef, useEffect, useMemo } from 'react';
import apiClient from '../../api/apiClient';
import {
    Trash2, Play, Square, AlertTriangle, CheckCircle,
    XCircle, ShieldAlert, List, RefreshCw, KeyRound, AlertOctagon, CheckSquare, Square as SquareIcon
} from 'lucide-react';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CHALLENGE_WORD = 'DELETE';
const REQUIRED_PASSKEY = 'AITC-ADMIN';

const BatchDelete = () => {
    const [sites, setSites] = useState([]);
    const [selectedSites, setSelectedSites] = useState(new Set());
    const [isLoadingSites, setIsLoadingSites] = useState(false);

    // Passkey state
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passkeyInput, setPasskeyInput] = useState('');
    const [passkeyError, setPasskeyError] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [challengeInput, setChallengeInput] = useState('');

    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const stopRef = useRef(false);
    const mountedRef = useRef(true);

    const scanSites = async () => {
        setIsLoadingSites(true);
        setSelectedSites(new Set()); // Reset selection on scan
        try {
            const res = await apiClient.get('/overview/sites');
            const list = Array.isArray(res.data) ? res.data : (res.data?.sites || []);
            if (mountedRef.current) setSites(list);
        } catch (err) {
            if (mountedRef.current) setSites([]);
        } finally {
            if (mountedRef.current) setIsLoadingSites(false);
        }
    };

    useEffect(() => {
        scanSites();
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Only allow deletion of sites where the user is an administrator
    const adminSites = useMemo(() => {
        return sites.filter(s => {
            const role = (s.role || '').toLowerCase();
            return role === 'administrator' || role === 'admin';
        });
    }, [sites]);

    const handleSelectAll = () => {
        if (selectedSites.size === adminSites.length && adminSites.length > 0) {
            setSelectedSites(new Set());
        } else {
            setSelectedSites(new Set(adminSites.map(s => s.siteId)));
        }
    };

    const toggleSite = (siteId) => {
        const newSet = new Set(selectedSites);
        if (newSet.has(siteId)) {
            newSet.delete(siteId);
        } else {
            newSet.add(siteId);
        }
        setSelectedSites(newSet);
    };

    const handleOpenModal = () => {
        setChallengeInput('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setChallengeInput('');
    };

    const canConfirmDestruction = challengeInput === CHALLENGE_WORD && !isRunning;

    const handleStart = async () => {
        setShowModal(false); // Close modal on start
        stopRef.current = false;
        setIsRunning(true);
        setProgress(0);

        const targetSites = adminSites.filter(s => selectedSites.has(s.siteId));
        const total = targetSites.length;

        const initialLogs = targetSites.map((site, i) => ({
            id: `delete-${i}`,
            siteId: site.siteId,
            name: site.siteName || site.siteId,
            status: 'pending',
            msg: 'Waiting...'
        }));
        setLogs(initialLogs);

        for (let i = 0; i < total; i++) {
            if (stopRef.current) {
                setLogs(prev => prev.map((l, idx) =>
                    idx >= i ? { ...l, status: 'stopped', msg: 'Stopped by user' } : l
                ));
                break;
            }

            const site = targetSites[i];
            const now = new Date();
            const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

            setLogs(prev => prev.map((l, idx) =>
                idx === i ? { ...l, status: 'running', msg: `${timeStr} Deleting Site '${site.siteName}'...` } : l
            ));

            try {
                // Warning: Extreme Caution Required
                await apiClient.delete(`/replay/api/sites/${site.siteId}`);
                if (!mountedRef.current) return;
                setLogs(prev => prev.map((l, idx) =>
                    idx === i ? { ...l, status: 'ok', msg: `${timeStr} Deleting Site '${site.siteName}'... SUCCESS` } : l
                ));
            } catch (err) {
                if (!mountedRef.current) return;
                const status = err.response?.status;
                const errMsg = err.response?.data?.detail || err.message || 'Unknown error';

                let logMsg = `${timeStr} Deleting Site '${site.siteName}'... FAILED`;
                if (status === 401 || status === 403) logMsg += ' (Unauthorized)';
                else if (status === 404) logMsg += ' (Not Found)';
                else logMsg += ` (${errMsg})`;

                setLogs(prev => prev.map((l, idx) =>
                    idx === i ? { ...l, status: 'error', msg: logMsg } : l
                ));

                // Optional: Pause on catastrophic errors, but we might want to continue deleting other sites.
                // For now, let's pause on auth/rate-limit to protect the token.
                if (status === 429 || status === 401 || status === 403 || status >= 500) {
                    stopRef.current = true;
                    setLogs(prev => [...prev, { id: `sys-err-${i}`, name: 'System Paused', status: 'error', msg: 'Emergency Stop: Batch paused due to critical API error.' }]);
                    break;
                }
            }

            if (!mountedRef.current) return;
            setProgress(i + 1);

            if (i < total - 1 && !stopRef.current) {
                await delay(2000); // Strict 2 second delay for safety
                if (!mountedRef.current) return;
            }
        }

        if (mountedRef.current) {
            setIsRunning(false);
            // Refresh sites after batch delete completes
            scanSites();
        }
    };

    const handleStop = () => {
        stopRef.current = true;
    };

    const progressPct = selectedSites.size > 0 ? Math.round((progress / selectedSites.size) * 100) : 0;
    const targetSites = adminSites.filter(s => selectedSites.has(s.siteId));

    const handleUnlock = (e) => {
        e.preventDefault();
        if (passkeyInput === REQUIRED_PASSKEY) {
            setIsUnlocked(true);
            setPasskeyError(false);
        } else {
            setPasskeyError(true);
            setPasskeyInput('');
        }
    };

    if (!isUnlocked) {
        return (
            <div className="w-full min-h-[700px] flex items-center justify-center bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-200 dark:border-gray-800 shadow-xl p-8 relative overflow-hidden">
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-600/5 dark:bg-rose-600/10 blur-[120px] rounded-full" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/5 dark:bg-red-600/10 blur-[120px] rounded-full" />
                </div>

                <form onSubmit={handleUnlock} className="relative z-10 max-w-sm w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-rose-100 dark:border-rose-900/30 flex flex-col items-center gap-6">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400">
                        <KeyRound size={32} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Restricted Area</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Enter the admin passkey to access the Batch Deletion tool.</p>
                    </div>
                    <div className="w-full relative">
                        <input
                            type="password"
                            value={passkeyInput}
                            onChange={e => {
                                setPasskeyInput(e.target.value);
                                setPasskeyError(false);
                            }}
                            placeholder="Enter Passkey"
                            autoFocus
                            className={`w-full text-center bg-slate-50 dark:bg-black/50 border-2 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-colors ${passkeyError ? 'border-rose-500 dark:border-rose-500/80 animate-shake' : 'border-slate-200 dark:border-slate-800 focus:border-rose-500 dark:focus:border-rose-500'}`}
                        />
                        {passkeyError && (
                            <p className="text-[10px] text-rose-500 font-bold text-center mt-2 absolute w-full -bottom-5">Incorrect Passkey</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!passkeyInput}
                        className="w-full h-12 mt-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_10px_30px_rgba(225,29,72,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        Unlock Tool
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="relative w-full min-h-[700px] bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-600/5 dark:bg-rose-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/5 dark:bg-red-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            Batch Site Deletion
                            <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/30">High Risk</span>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Permanently destroy multiple sites. This action cannot be undone.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Panel 1: Site Selection (Scan & Select) */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl dark:shadow-none min-h-[500px]">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <List size={14} className="text-rose-500" /> Source Sites
                            </h3>
                            <button
                                onClick={scanSites}
                                disabled={isLoadingSites || isRunning}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase hover:text-rose-500 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={isLoadingSites ? 'animate-spin' : ''} />
                                Scan Sites
                            </button>
                        </div>

                        {isLoadingSites ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                                <RefreshCw size={36} strokeWidth={1} className="animate-spin" />
                                <p className="text-xs text-center">Scanning accessible sites...</p>
                            </div>
                        ) : adminSites.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600 px-4">
                                <ShieldAlert size={36} strokeWidth={1} className="text-amber-500/50" />
                                <p className="text-xs text-center">You do not possess Administrator privileges on any active sites.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-2 p-3 bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-xl mb-2">
                                    <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold uppercase tracking-wide">Warning: Only Administrator sites are shown. Selected sites will be permanently deleted.</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                                    <button
                                        onClick={handleSelectAll}
                                        disabled={isRunning}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                                    >
                                        {selectedSites.size === adminSites.length ? (
                                            <><CheckSquare size={16} className="text-rose-500" /> Deselect All</>
                                        ) : (
                                            <><SquareIcon size={16} className="text-slate-400" /> Select All</>
                                        )}
                                    </button>
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                                        <span className="text-rose-500">{selectedSites.size}</span> / {adminSites.length}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[360px] pr-2 space-y-2 custom-scrollbar">
                                    {adminSites.map(site => (
                                        <div
                                            key={site.siteId}
                                            onClick={() => !isRunning && toggleSite(site.siteId)}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${selectedSites.has(site.siteId)
                                                ? 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                                                : 'bg-white dark:bg-black/20 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                                                } ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <div className="shrink-0 flex items-center justify-center">
                                                {selectedSites.has(site.siteId) ? (
                                                    <CheckSquare size={18} className="text-rose-600 dark:text-rose-400" />
                                                ) : (
                                                    <SquareIcon size={18} className="text-slate-300 dark:text-slate-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{site.siteName}</p>
                                                <p className="text-[10px] font-mono text-slate-500 truncate">{site.siteId}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        <div className="mt-4 pt-2 border-t border-slate-100 dark:border-white/5">
                            <button
                                onClick={handleOpenModal}
                                disabled={selectedSites.size === 0 || isRunning}
                                className="w-full h-12 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-[0_10px_30px_rgba(225,29,72,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} /> Delete Selected ({selectedSites.size})
                            </button>
                        </div>
                    </div>

                    {/* Panel 2: Live Execution Log */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl dark:shadow-none min-h-[500px]">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Play size={14} className="text-rose-500" /> Deletion Log
                        </h3>

                        {logs.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {isRunning
                                            ? `Destroying ${progress} of ${selectedSites.size}...`
                                            : progress === selectedSites.size
                                                ? `Destruction Complete: ${selectedSites.size} sites removed.`
                                                : `Emergency Stop at ${progress} of ${selectedSites.size}`}
                                    </span>
                                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                                        {progressPct}%
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isRunning ? 'bg-gradient-to-r from-rose-500 to-red-500' : progress === selectedSites.size ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto max-h-[380px] space-y-1.5 font-mono pr-1 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-600 py-12">
                                    <AlertOctagon size={28} strokeWidth={1} className="opacity-50" />
                                    <p className="text-xs text-center font-sans">Ready for destructive sequence.</p>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[11px] border transition-colors ${log.status === 'ok'
                                            ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/10'
                                            : log.status === 'error'
                                                ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/10'
                                                : log.status === 'running'
                                                    ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/10 animate-pulse'
                                                    : log.status === 'stopped'
                                                        ? 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10'
                                                        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                            }`}
                                    >
                                        <span className="shrink-0 mt-0.5">
                                            {log.status === 'ok' && <CheckCircle size={12} className="text-emerald-500" />}
                                            {log.status === 'error' && <XCircle size={12} className="text-rose-500" />}
                                            {log.status === 'running' && (
                                                <div className="w-3 h-3 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                                            )}
                                            {log.status === 'stopped' && <Square size={12} className="text-slate-400" />}
                                            {log.status === 'pending' && (
                                                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600" />
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold ${log.status === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'} text-[10px] break-all`}>
                                                {log.msg}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {isRunning && (
                            <div className="mt-4 pt-2 border-t border-slate-100 dark:border-white/5">
                                <button
                                    onClick={handleStop}
                                    className="w-full h-12 bg-black dark:bg-white/10 text-rose-500 dark:text-rose-400 border border-black dark:border-rose-500/30 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-900 dark:hover:bg-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Square size={16} /> EMERGENCY STOP
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* 2-Step Confirmation Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-fade-in relative">
                        {/* Danger header stripe */}
                        <div className="h-2 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-500" />

                        <div className="p-6 pb-2">
                            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 mx-auto shadow-[0_0_20px_rgba(225,29,72,0.3)]">
                                <AlertTriangle size={24} />
                            </div>
                            <h2 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">Confirm Destruction</h2>
                            <p className="text-sm text-center text-slate-600 dark:text-slate-400 mb-6">
                                You are about to permanently delete <strong className="text-rose-600 dark:text-rose-400">{selectedSites.size}</strong> site(s). This action will erase all configurations and data. It cannot be undone.
                            </p>

                            <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl p-3 mb-6 max-h-32 overflow-y-auto custom-scrollbar">
                                <ul className="space-y-1">
                                    {targetSites.map(s => (
                                        <li key={s.siteId} className="text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <XCircle size={10} className="text-rose-500 shrink-0" /> <span className="truncate">{s.siteName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-col gap-2 mb-4">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">
                                    Type <span className="font-mono bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-1 py-0.5 rounded select-all">{CHALLENGE_WORD}</span> to proceed
                                </label>
                                <input
                                    type="text"
                                    value={challengeInput}
                                    onChange={e => setChallengeInput(e.target.value)}
                                    placeholder={CHALLENGE_WORD}
                                    className="w-full text-center bg-white dark:bg-black/50 border-2 border-slate-300 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 rounded-xl px-4 py-3 text-lg font-black tracking-widest text-slate-900 dark:text-rose-500 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-white/5">
                            <button
                                onClick={handleCloseModal}
                                className="h-12 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStart}
                                disabled={!canConfirmDestruction}
                                className="h-12 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <KeyRound size={16} className={canConfirmDestruction ? 'animate-pulse' : ''} /> Destroy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchDelete;
