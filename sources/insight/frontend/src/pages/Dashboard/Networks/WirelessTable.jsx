import React from 'react';
import { Wifi, Users, ArrowUp, ArrowDown } from 'lucide-react';

// --- Helpers ---
const HEALTH_DOT = {
    good:    'bg-emerald-500',
    warning: 'bg-amber-500',
    poor:    'bg-rose-500',
    unknown: 'bg-slate-600',
};

const formatBytes = (bytes) => {
    if (bytes == null) return '—';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const BAND_LABEL = {
    '5ghz':   '5 GHz',
    '2.4ghz': '2.4 GHz',
    '6ghz':   '6 GHz',
};
const getBandLabel = (band) => BAND_LABEL[band?.toLowerCase()] || band || '—';

// --- Component ---
const WirelessTable = ({ data, sortConfig, onSort, loading }) => {
    const SortIcon = ({ column }) => {
        if (sortConfig?.key !== column)
            return <ArrowDown size={12} className="opacity-20 ml-1 inline" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={12} className="text-indigo-500 ml-1 inline" />
            : <ArrowDown size={12} className="text-indigo-500 ml-1 inline" />;
    };

    return (
        <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden w-full">
            <div className="max-h-[calc(100vh-360px)] overflow-auto custom-scrollbar">
                <table className="w-full min-w-[900px] text-left text-sm whitespace-nowrap">
                    <thead className="text-slate-500 border-b border-white/5 sticky top-0 z-10 bg-slate-900">
                        <tr>
                            <th
                                onClick={() => onSort?.('name')}
                                className="px-8 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors min-w-[220px]"
                            >
                                Network <SortIcon column="name" />
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[100px]">
                                State
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[100px]">
                                Health
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[100px]">
                                Band
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[100px]">
                                Security
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[100px]">
                                VLAN
                            </th>
                            <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] min-w-[120px]">
                                24h Usage
                            </th>
                            <th
                                onClick={() => onSort?.('clients')}
                                className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors text-right min-w-[100px]"
                            >
                                Clients <SortIcon column="clients" />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                        {/* Skeleton rows while loading */}
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <tr key={`wskel-${i}`} className="animate-pulse">
                                <td className="px-8 py-5"><div className="h-4 bg-slate-800 rounded w-40" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-12" /></td>
                                <td className="px-6 py-5"><div className="h-4 bg-slate-800 rounded w-20" /></td>
                                <td className="px-6 py-5 text-right"><div className="h-4 bg-slate-800 rounded w-10 ml-auto" /></td>
                            </tr>
                        ))}

                        {!loading && data.map(ssid => {
                            const dotClass = HEALTH_DOT[ssid.health] || HEALTH_DOT.unknown;
                            const healthLabel = ssid.health
                                ? ssid.health.charAt(0).toUpperCase() + ssid.health.slice(1)
                                : 'Unknown';
                            return (
                                <tr key={ssid.id} className="hover:bg-white/[0.02] transition-colors group">
                                    {/* Network Name */}
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                                                <Wifi size={14} />
                                            </div>
                                            <p className="text-white font-black text-sm tracking-tight italic uppercase truncate max-w-[180px]" title={ssid.name}>
                                                {ssid.name}
                                            </p>
                                        </div>
                                    </td>

                                    {/* State */}
                                    <td className="px-6 py-5">
                                        {ssid.isEnabled ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                </span>
                                                Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                <span className="w-2 h-2 rounded-full bg-slate-700" />
                                                Inactive
                                            </span>
                                        )}
                                    </td>

                                    {/* Health */}
                                    <td className="px-6 py-5">
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                                            {healthLabel}
                                        </span>
                                    </td>

                                    {/* Band */}
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-slate-400">
                                            {getBandLabel(ssid.band)}
                                        </span>
                                    </td>

                                    {/* Security */}
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-slate-400">
                                            {ssid.security || '—'}
                                        </span>
                                    </td>

                                    {/* VLAN */}
                                    <td className="px-6 py-5">
                                        <span className="font-mono font-black text-indigo-400 text-sm bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                                            {ssid.vlanId ?? '—'}
                                        </span>
                                    </td>

                                    {/* 24h Usage */}
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-slate-500">
                                            {formatBytes(ssid.usage24h)}
                                        </span>
                                    </td>

                                    {/* Clients */}
                                    <td className="px-6 py-5 text-right">
                                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
                                            ssid.clients > 0
                                                ? 'bg-slate-800 border-indigo-500/20 group-hover:border-indigo-500/40'
                                                : 'bg-slate-900 border-white/5 opacity-50'
                                        }`}>
                                            <Users size={12} className={ssid.clients > 0 ? 'text-indigo-400' : 'text-slate-600'} />
                                            <span className={`font-black text-sm ${ssid.clients > 0 ? 'text-white' : 'text-slate-600'}`}>
                                                {ssid.clients}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {!loading && data.length === 0 && (
                            <tr>
                                <td colSpan="8" className="px-6 py-24 text-center text-slate-500">
                                    <div className="flex flex-col items-center">
                                        <div className="p-6 bg-slate-800 rounded-3xl mb-6 opacity-20">
                                            <Wifi size={64} className="text-slate-400" />
                                        </div>
                                        <p className="text-xl font-black text-slate-700 uppercase tracking-[0.2em]">No Wireless Networks</p>
                                        <p className="text-xs text-slate-600 mt-3 font-bold uppercase tracking-widest">No SSIDs found for this site</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WirelessTable;
