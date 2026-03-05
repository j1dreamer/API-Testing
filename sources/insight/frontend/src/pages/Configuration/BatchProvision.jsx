import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
    Layers, Play, Square, AlertTriangle, CheckCircle,
    XCircle, ChevronRight, Globe, Clock, Hash, Tag
} from 'lucide-react';

const TIMEZONES = [
    { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul (UTC+9)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+11)' },
];

const REG_DOMAINS = [
    { value: 'VN', label: 'VN — Vietnam' },
    { value: 'JP', label: 'JP — Japan' },
    { value: 'US', label: 'US — United States' },
    { value: 'SG', label: 'SG — Singapore' },
    { value: 'TH', label: 'TH — Thailand' },
    { value: 'KR', label: 'KR — South Korea' },
    { value: 'CN', label: 'CN — China' },
    { value: 'AU', label: 'AU — Australia' },
    { value: 'GB', label: 'GB — United Kingdom' },
    { value: 'DE', label: 'DE — Germany' },
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

const BatchProvision = () => {
    const [sites, setSites] = useState([]);
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [prefix, setPrefix] = useState('');
    const [cloneCount, setCloneCount] = useState(5);
    const [regDomain, setRegDomain] = useState('VN');
    const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
    const [delayMs, setDelayMs] = useState(2000);

    // Feature 2: Location Override State
    const [overrideLocation, setOverrideLocation] = useState(false);
    const [lat, setLat] = useState('21.02884');
    const [lng, setLng] = useState('105.85462');
    const [address, setAddress] = useState('Vietnam');

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

    const selectedSite = sites.find(s => s.siteId === selectedSourceId);
    const siteRole = (selectedSite?.role || '').toLowerCase();

    // Feature 1: Form Validation Logic
    const isAdmin = siteRole === 'administrator' || siteRole === 'admin';
    const isPrefixValid = prefix.trim() !== '';
    const isCloneCountValid = cloneCount >= 1 && cloneCount <= 50;

    const isLocationValid = !overrideLocation || (overrideLocation && lat.trim() !== '' && lng.trim() !== '' && address.trim() !== '');

    const canStart = isAdmin && isPrefixValid && isCloneCountValid && isLocationValid && selectedSourceId !== '' && !isRunning;

    const handleStart = async () => {
        stopRef.current = false;
        setIsRunning(true);
        setProgress(0);

        const initial = Array.from({ length: cloneCount }, (_, i) => {
            const padded = String(i + 1).padStart(2, '0');
            return { id: `clone-${i}`, name: `${prefix.trim()} - ${padded}`, status: 'pending', msg: 'Waiting...' };
        });
        setLogs(initial);

        for (let i = 0; i < cloneCount; i++) {
            if (stopRef.current) {
                setLogs(prev => prev.map((l, idx) =>
                    idx >= i ? { ...l, status: 'stopped', msg: 'Stopped by user' } : l
                ));
                break;
            }

            const siteName = initial[i].name;

            setLogs(prev => prev.map((l, idx) =>
                idx === i ? { ...l, status: 'running', msg: 'Provisioning...' } : l
            ));

            try {
                const payload = {
                    siteName: siteName,
                    regulatoryDomain: regDomain,
                    timezoneIana: timezone,
                    configuredLocation: {
                        latitude: overrideLocation ? lat : (selectedSite?.configuredLocation?.latitude || "21.02884"),
                        longitude: overrideLocation ? lng : (selectedSite?.configuredLocation?.longitude || "105.85462"),
                        address: overrideLocation ? address : (selectedSite?.configuredLocation?.address || "Vietnam")
                    }
                };
                await apiClient.post(`/replay/api/sites/${selectedSourceId}/siteCloning`, payload, {
                    headers: { 'X-ION-API-VERSION': '23' }
                });
                if (!mountedRef.current) return;
                setLogs(prev => prev.map((l, idx) =>
                    idx === i ? { ...l, status: 'ok', msg: 'Created successfully' } : l
                ));
            } catch (err) {
                if (!mountedRef.current) return;
                const status = err.response?.status;
                const errMsg = err.response?.data?.detail || err.message || 'Unknown error';

                setLogs(prev => prev.map((l, idx) =>
                    idx === i ? { ...l, status: 'error', msg: `[${status}] ${errMsg}` } : l
                ));

                // Feature 4: Error Handling & Pause Batch
                if (status === 429 || status === 401 || status === 403 || status >= 500) {
                    stopRef.current = true; // Auto-pause the batch
                    setLogs(prev => [...prev, { id: `sys-err-${i}`, name: 'System Paused', status: 'error', msg: 'Batch paused due to critical API error or rate limit.' }]);
                    break;
                }
            }

            if (!mountedRef.current) return;
            setProgress(i + 1);

            if (i < cloneCount - 1 && !stopRef.current) {
                await delay(delayMs);
                if (!mountedRef.current) return;
            }
        }

        if (mountedRef.current) setIsRunning(false);
    };

    const handleStop = () => {
        stopRef.current = true;
    };

    const progressPct = cloneCount > 0 ? Math.round((progress / cloneCount) * 100) : 0;

    return (
        <div className="relative w-full min-h-[700px] bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/5 dark:bg-violet-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Batch Site Provisioning</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Mass-produce identical site configurations with specific overrides</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Panel 1: Config Form */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl dark:shadow-none">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Tag size={14} className="text-violet-500" /> Configuration
                        </h3>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Template Site</label>
                            <select
                                value={selectedSourceId}
                                onChange={e => setSelectedSourceId(e.target.value)}
                                disabled={isRunning}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white appearance-none focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                            >
                                <option value="">— Select template site —</option>
                                {sites.map(s => (
                                    <option key={s.siteId} value={s.siteId} className="bg-white dark:bg-slate-900">
                                        {s.siteName}
                                    </option>
                                ))}
                            </select>
                            {selectedSite && (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${getRoleBadgeInfo(selectedSite.role).classes}`}>
                                        {getRoleBadgeInfo(selectedSite.role).text}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">{selectedSite.siteId}</span>
                                </div>
                            )}
                        </div>

                        {selectedSourceId && !isAdmin && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                    Batch Provisioning requires Administrator privileges on the template site.
                                </span>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Site Name Prefix</label>
                            <input
                                type="text"
                                value={prefix}
                                onChange={e => setPrefix(e.target.value)}
                                disabled={isRunning}
                                placeholder="e.g. AITC-Office"
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                            />
                            {prefix && (
                                <span className="text-[10px] text-slate-400 font-mono">Preview: {prefix.trim()} - 01, {prefix.trim()} - 02...</span>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Hash size={11} /> Number of Clones</label>
                                <span className="text-sm font-black text-violet-600 dark:text-violet-400">{cloneCount}</span>
                            </div>
                            <input
                                type="range"
                                min={1} max={50}
                                value={cloneCount}
                                onChange={e => setCloneCount(Number(e.target.value))}
                                disabled={isRunning}
                                className="w-full accent-violet-500 disabled:opacity-50"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                <span>1</span><span>50</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Globe size={11} /> Regulatory Domain</label>
                            <select
                                value={regDomain}
                                onChange={e => setRegDomain(e.target.value)}
                                disabled={isRunning}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white appearance-none focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                            >
                                {REG_DOMAINS.map(d => <option key={d.value} value={d.value} className="bg-white dark:bg-slate-900">{d.label}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock size={11} /> Timezone</label>
                            <select
                                value={timezone}
                                onChange={e => setTimezone(e.target.value)}
                                disabled={isRunning}
                                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white appearance-none focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                            >
                                {TIMEZONES.map(z => <option key={z.value} value={z.value} className="bg-white dark:bg-slate-900">{z.label}</option>)}
                            </select>
                        </div>

                        {/* Feature 2: Location Override Form */}
                        <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={overrideLocation}
                                    onChange={(e) => setOverrideLocation(e.target.checked)}
                                    disabled={isRunning}
                                    className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                                />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Override Source Location</span>
                            </label>

                            {overrideLocation && (
                                <div className="grid grid-cols-2 gap-3 mt-2 animate-fade-in">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Latitude</label>
                                        <input type="text" value={lat} onChange={e => setLat(e.target.value)} disabled={isRunning} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500/50" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Longitude</label>
                                        <input type="text" value={lng} onChange={e => setLng(e.target.value)} disabled={isRunning} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500/50" />
                                    </div>
                                    <div className="flex flex-col gap-1.5 col-span-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Address</label>
                                        <input type="text" value={address} onChange={e => setAddress(e.target.value)} disabled={isRunning} className="w-full bg-white dark:bg-black/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500/50" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Delay Between Requests</label>
                                <span className="text-sm font-black text-violet-600 dark:text-violet-400">{(delayMs / 1000).toFixed(1)}s</span>
                            </div>
                            <input
                                type="range"
                                min={500} max={5000} step={500}
                                value={delayMs}
                                onChange={e => setDelayMs(Number(e.target.value))}
                                disabled={isRunning}
                                className="w-full accent-violet-500 disabled:opacity-50"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                <span>0.5s</span><span>5.0s</span>
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: Template Summary */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-5 shadow-xl dark:shadow-none">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <ChevronRight size={14} className="text-violet-500" /> Provision Summary
                        </h3>

                        {!selectedSourceId || !prefix.trim() ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                                <Layers size={36} strokeWidth={1} />
                                <p className="text-xs text-center">Select a template site and enter a prefix to preview the batch plan.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Template Site</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedSite?.siteName}</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{selectedSourceId}</p>
                                    {selectedSite && (
                                        <span className={`inline-block mt-2 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${getRoleBadgeInfo(selectedSite.role).classes}`}>
                                            {getRoleBadgeInfo(selectedSite.role).text}
                                        </span>
                                    )}
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Sites to Create ({cloneCount})</p>
                                    <div className="space-y-1.5">
                                        {Array.from({ length: Math.min(cloneCount, 4) }, (_, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                                    {prefix.trim()} - {String(i + 1).padStart(2, '0')}
                                                </span>
                                            </div>
                                        ))}
                                        {cloneCount > 4 && (
                                            <p className="text-[10px] text-slate-400 pl-3.5">+ {cloneCount - 4} more...</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl text-center">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">API Calls</p>
                                        <p className="text-xl font-black text-violet-600 dark:text-violet-400 mt-1">{cloneCount}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl text-center">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Est. Time</p>
                                        <p className="text-xl font-black text-violet-600 dark:text-violet-400 mt-1">
                                            {Math.ceil(((cloneCount - 1) * delayMs + cloneCount * 800) / 1000)}s
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Parameters</p>
                                    {[
                                        ['Domain', regDomain],
                                        ['Timezone', timezone],
                                        ['Delay', `${(delayMs / 1000).toFixed(1)}s`],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500">{k}</span>
                                            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel 3: Live Execution Log */}
                    <div className="backdrop-blur-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl dark:shadow-none">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Play size={14} className="text-violet-500" /> Execution Log
                        </h3>

                        {logs.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {isRunning
                                            ? `Cloning ${progress} of ${cloneCount}...`
                                            : progress === cloneCount
                                                ? `Completed: ${cloneCount} of ${cloneCount}`
                                                : `Stopped at ${progress} of ${cloneCount}`}
                                    </span>
                                    <span className="text-[10px] font-black text-violet-600 dark:text-violet-400">
                                        {progressPct}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto max-h-72 space-y-1.5 font-mono pr-1 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-600 py-12">
                                    <Play size={28} strokeWidth={1} />
                                    <p className="text-xs text-center">Configure and press Start to begin provisioning.</p>
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
                                                    ? 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/10 animate-pulse'
                                                    : log.status === 'stopped'
                                                        ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/10'
                                                        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                                            }`}
                                    >
                                        <span className="shrink-0 mt-0.5">
                                            {log.status === 'ok' && <CheckCircle size={12} className="text-emerald-500" />}
                                            {log.status === 'error' && <XCircle size={12} className="text-rose-500" />}
                                            {log.status === 'running' && (
                                                <div className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                                            )}
                                            {log.status === 'stopped' && <Square size={12} className="text-amber-500" />}
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
                                                        ? 'text-violet-700 dark:text-violet-300'
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
                                    className="flex-1 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-[0_10px_30px_rgba(124,58,237,0.2)] dark:shadow-[0_10px_40px_rgba(124,58,237,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Play size={16} /> Start Batch Clone
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

export default BatchProvision;
