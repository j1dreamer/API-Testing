import React, { useState, useRef, useEffect, useMemo } from 'react';
import apiClient from '../../api/apiClient';
import {
    Users, Play, Square, AlertTriangle, CheckCircle,
    XCircle, ChevronRight, Mail, Tag, List, Shield, CheckSquare, Square as SquareIcon
} from 'lucide-react';

export const AVAILABLE_ROLES = [
    { label: 'Administrator', value: 'administrator' },
    { label: 'Viewer', value: 'viewer' },
    // Placeholders for future roles
    // { label: 'Operator', value: 'operator' },
    // { label: 'Delegate', value: 'delegate' },
];

const getRoleBadgeInfo = (roleStr) => {
    const role = (roleStr || 'UNKNOWN').toLowerCase();
    switch (role) {
        case 'administrator':
        case 'admin':
            return { text: 'ADMIN', classes: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50' };
        case 'operator':
        case 'op':
            return { text: 'OPERATOR', classes: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50' };
        case 'viewer':
        case 'view':
            return { text: 'VIEWER', classes: 'bg-slate-200 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600/50' };
        case 'delegate':
            return { text: 'DELEGATE', classes: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50' };
        default:
            return { text: role.toUpperCase(), classes: 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 border-slate-200 dark:border-slate-700/50' };
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const BatchAccountAccess = () => {
    const [sites, setSites] = useState([]);
    const [email, setEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState(AVAILABLE_ROLES[0].value);
    const [selectedSites, setSelectedSites] = useState(new Set());
    const [mode, setMode] = useState('add'); // 'add' or 'remove'

    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const stopRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        apiClient.get('/overview/sites').then(res => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.sites || []);
            setSites(list);
        }).catch(() => setSites([]));
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Filter out sites where the current user is not an admin, since we cannot add accounts without admin rights
    const adminSites = useMemo(() => {
        return sites.filter(s => {
            const role = (s.role || '').toLowerCase();
            return role === 'administrator' || role === 'admin';
        });
    }, [sites]);

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const canStart = isEmailValid && selectedSites.size > 0 && !isRunning;

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

    const handleStart = async () => {
        stopRef.current = false;
        setIsRunning(true);
        setProgress(0);

        const targetSites = adminSites.filter(s => selectedSites.has(s.siteId));
        const total = targetSites.length;

        const initialLogs = targetSites.map((site, i) => ({
            id: `access-${i}`,
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

            setLogs(prev => prev.map((l, idx) =>
                idx === i ? { ...l, status: 'running', msg: mode === 'add' ? 'Adding account...' : 'Removing account...' } : l
            ));

            try {
                if (mode === 'add') {
                    const payload = {
                        email: email,
                        roleOnSite: selectedRole
                    };
                    await apiClient.post(`/replay/api/sites/${site.siteId}/administration?action=addAccount`, payload);
                    if (!mountedRef.current) return;
                    setLogs(prev => prev.map((l, idx) =>
                        idx === i ? { ...l, status: 'ok', msg: 'Added successfully' } : l
                    ));
                } else {
                    const payload = {
                        email: email
                    };
                    await apiClient.post(`/replay/api/sites/${site.siteId}/administration?action=removeAccount`, payload);
                    if (!mountedRef.current) return;
                    setLogs(prev => prev.map((l, idx) =>
                        idx === i ? { ...l, status: 'ok', msg: 'Access revoked' } : l
                    ));
                }
            } catch (err) {
                if (!mountedRef.current) return;
                const status = err.response?.status;
                const errMsg = err.response?.data?.detail || err.message || 'Unknown error';

                let logMsg = `[${status || 'ERR'}] ${errMsg}`;
                if (status === 409) logMsg = 'User already exists on site';
                else if (status === 404 && mode === 'remove') logMsg = 'Failed (User not found)';
                else if (status === 400) logMsg = 'Bad request';

                setLogs(prev => prev.map((l, idx) =>
                    idx === i ? { ...l, status: 'error', msg: logMsg } : l
                ));

                if (status === 429 || status === 401 || status === 403 || status >= 500) {
                    stopRef.current = true;
                    setLogs(prev => [...prev, { id: `sys-err-${i}`, name: 'System Paused', status: 'error', msg: 'Batch paused due to critical API error.' }]);
                    break;
                }
            }

            if (!mountedRef.current) return;
            setProgress(i + 1);

            if (i < total - 1 && !stopRef.current) {
                await delay(1000); // Strict 1 second delay
                if (!mountedRef.current) return;
            }
        }

        if (mountedRef.current) setIsRunning(false);
    };

    const handleStop = () => {
        stopRef.current = true;
    };

    const progressPct = selectedSites.size > 0 ? Math.round((progress / selectedSites.size) * 100) : 0;

    return (
        <div className="relative w-full min-h-[700px] bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/5 dark:bg-amber-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/5 dark:bg-orange-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
                        <Users size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Batch Account Access</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Add a single email user to multiple sites simultaneously</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Panel 1: Global Config */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl dark:shadow-none h-fit">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                            <Tag size={14} className="text-amber-500" /> Configuration
                        </h3>

                        <div className="flex bg-slate-100 dark:bg-black/30 p-1 rounded-xl mb-1">
                            <button
                                onClick={() => setMode('add')}
                                disabled={isRunning}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'add' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Add Account
                            </button>
                            <button
                                onClick={() => setMode('remove')}
                                disabled={isRunning}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'remove' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Remove Access
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Mail size={11} /> Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={isRunning}
                                placeholder="user@example.com"
                                className={`w-full bg-slate-50 dark:bg-black/40 border rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50 ${email && !isEmailValid ? 'border-rose-300 dark:border-rose-500/30' : 'border-slate-200 dark:border-white/5'}`}
                            />
                            {email && !isEmailValid && (
                                <span className="text-[10px] text-rose-500 font-bold mt-1">Please enter a valid email.</span>
                            )}
                        </div>

                        {mode === 'add' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Shield size={11} /> Role to Assign</label>
                                <select
                                    value={selectedRole}
                                    onChange={e => setSelectedRole(e.target.value)}
                                    disabled={isRunning}
                                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white appearance-none focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                                >
                                    {AVAILABLE_ROLES.map(r => <option key={r.value} value={r.value} className="bg-white dark:bg-slate-900">{r.label}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2 mt-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Operation Summary</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">Target User</span>
                                <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{email || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">Action</span>
                                <span className={`text-[10px] font-mono font-bold ${mode === 'add' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {mode === 'add' ? 'ADD ACCOUNT' : 'REMOVE ACCESS'}
                                </span>
                            </div>
                            {mode === 'add' && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500">Target Role</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">{AVAILABLE_ROLES.find(r => r.value === selectedRole)?.label}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">Sites Selected</span>
                                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">{selectedSites.size}</span>
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: Site Selection */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl dark:shadow-none min-h-[400px]">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <div className="flex items-center gap-2"><List size={14} className="text-amber-500" /> Target Sites</div>
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[9px]">
                                {selectedSites.size} / {adminSites.length} Selected
                            </span>
                        </h3>

                        {sites.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                                <List size={36} strokeWidth={1} />
                                <p className="text-xs text-center">Loading sites...</p>
                            </div>
                        ) : adminSites.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600 px-4">
                                <AlertTriangle size={36} strokeWidth={1} className="text-amber-500/50" />
                                <p className="text-xs text-center">You do not have Administrator access to any sites. This action requires Administrator privileges.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                                    <button
                                        onClick={handleSelectAll}
                                        disabled={isRunning}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
                                    >
                                        {selectedSites.size === adminSites.length ? (
                                            <><CheckSquare size={16} className="text-amber-500" /> Deselect All</>
                                        ) : (
                                            <><SquareIcon size={16} className="text-slate-400" /> Select All</>
                                        )}
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[360px] pr-2 space-y-2 custom-scrollbar">
                                    {adminSites.map(site => (
                                        <div
                                            key={site.siteId}
                                            onClick={() => !isRunning && toggleSite(site.siteId)}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${selectedSites.has(site.siteId)
                                                ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                                : 'bg-white dark:bg-black/20 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                                                } ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <div className="shrink-0 flex items-center justify-center">
                                                {selectedSites.has(site.siteId) ? (
                                                    <CheckSquare size={18} className="text-amber-600 dark:text-amber-400" />
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
                    </div>

                    {/* Panel 3: Live Execution Log */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl dark:shadow-none min-h-[400px]">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Play size={14} className="text-amber-500" /> Execution Log
                        </h3>

                        {logs.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {isRunning
                                            ? `Processing ${progress} of ${selectedSites.size}...`
                                            : progress === selectedSites.size
                                                ? `Completed: ${selectedSites.size} of ${selectedSites.size}`
                                                : `Stopped at ${progress} of ${selectedSites.size}`}
                                    </span>
                                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                                        {progressPct}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1.5 font-mono pr-1 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-600 py-12">
                                    <Play size={28} strokeWidth={1} />
                                    <p className="text-xs text-center">Configure and press Apply to begin.</p>
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
                                                    ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/10 animate-pulse'
                                                    : log.status === 'stopped'
                                                        ? 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10'
                                                        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                            }`}
                                    >
                                        <span className="shrink-0 mt-0.5">
                                            {log.status === 'ok' && <CheckCircle size={12} className="text-emerald-500" />}
                                            {log.status === 'error' && <XCircle size={12} className="text-rose-500" />}
                                            {log.status === 'running' && (
                                                <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                            )}
                                            {log.status === 'stopped' && <Square size={12} className="text-slate-400" />}
                                            {log.status === 'pending' && (
                                                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600" />
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-bold ${log.status === 'ok'
                                                ? 'text-emerald-700 dark:text-emerald-400'
                                                : log.status === 'error'
                                                    ? 'text-rose-700 dark:text-rose-400'
                                                    : log.status === 'running'
                                                        ? 'text-amber-700 dark:text-amber-400'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                }`}>{log.name}</span>
                                            <p className="text-slate-500 dark:text-slate-400 truncate text-[10px] mt-0.5">{log.msg}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-auto pt-2 flex gap-3">
                            {!isRunning ? (
                                <button
                                    onClick={handleStart}
                                    disabled={!canStart}
                                    className={`flex-1 h-12 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${mode === 'add'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_10px_30px_rgba(245,158,11,0.2)] hover:scale-[1.02] active:scale-95'
                                            : 'bg-gradient-to-r from-rose-600 to-red-600 shadow-[0_10px_30px_rgba(225,29,72,0.2)] hover:scale-[1.02] active:scale-95'
                                        }`}
                                >
                                    <Play size={16} /> {mode === 'add' ? 'Apply to Selected Sites' : 'Remove from Selected'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleStop}
                                    className="flex-1 h-12 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Square size={16} /> Stop
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BatchAccountAccess;
