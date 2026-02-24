import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, AlertCircle, Smartphone, Laptop, Monitor, Globe, Wifi, Circle, Radio, ArrowDown, ArrowUp, Database } from 'lucide-react';
import apiClient, { formatBytes } from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';

const Clients = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const { selectedSiteId, sites, fetchSites } = useSite();

    useEffect(() => {
        if (sites.length === 0) {
            fetchSites();
        }
    }, []);

    useEffect(() => {
        if (selectedSiteId) {
            fetchClients(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchClients = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            // Priority 1: clientSummary (Singular - found in logs)
            // Priority 2: clientsSummary (Plural)
            // Priority 3: clients
            // Priority 4: /v1/sites/{siteId}/clients
            let res;
            const endpoints = [
                `/proxy/api/sites/${siteId}/clientSummary`,
                `/proxy/api/sites/${siteId}/clientsSummary`,
                `/proxy/api/sites/${siteId}/clients`,
                `/proxy/api/v1/sites/${siteId}/clients`,
                `/proxy/api/v1/sites/${siteId}/dashboard` // Sometimes embedded here
            ];

            for (const url of endpoints) {
                try {
                    const tempRes = await apiClient.get(url);
                    if (tempRes.data && (Array.isArray(tempRes.data) || tempRes.data.elements || tempRes.data.clients || (tempRes.data.clientsOverview && tempRes.data.clientsOverview.clients))) {
                        res = tempRes;
                        console.log(`Successfully fetched from ${url}`, res.data);
                        break;
                    }
                } catch (e) {
                    // Only log if it's not a 401 (401 is handled by interceptor)
                    if (e.response?.status !== 401) {
                        console.warn(`Failed endpoint: ${url}`);
                    }
                }
            }

            if (!res) throw new Error("Could not find clients endpoint or no data available.");

            const data = res.data;
            let extracted = [];
            if (Array.isArray(data)) {
                extracted = data;
            } else if (data && data.elements) {
                extracted = data.elements;
            } else if (data && data.clients) {
                extracted = data.clients;
            } else if (data && data.clientsOverview && data.clientsOverview.clients) {
                extracted = data.clientsOverview.clients;
            }

            setClients(extracted);
        } catch (err) {
            console.error("Clients fetch error:", err);
            // Don't set error if it was a 401 (redirecting...)
            if (err.response?.status !== 401) {
                setError("Failed to fetch client list. Ensure you are logged in.");
            }
        } finally {
            setLoading(false);
        }
    };

    const getClientIcon = (type) => {
        const t = (type || "").toLowerCase();
        if (t.includes('phone')) return <Smartphone size={18} />;
        if (t.includes('computer') || t.includes('laptop')) return <Laptop size={18} />;
        return <Monitor size={18} />;
    };

    const filteredClients = (clients || []).filter(c => {
        if (!c) return false;
        return (
            (c.name || c.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.macAddress || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.ipAddress || "").toString().includes(searchTerm)
        );
    });

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Connected Clients</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Active sessions at {sites.find(s => s.siteId === selectedSiteId)?.siteName || 'current site'}
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Find clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-12 pl-10 pr-4 bg-black/40 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 w-full md:w-64"
                        />
                    </div>

                    <button
                        onClick={() => fetchClients(selectedSiteId)}
                        disabled={loading}
                        className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'SYNCING...' : 'REFRESH'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            <div className="bg-slate-900 rounded-2xl shadow-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-800/50 text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Client Device</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Connection / Port</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Network & VLAN</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Total Data (24h)</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Addressing</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                            {filteredClients.map((client) => {
                                const isWired = client.connectionType === 'WIRED';

                                // Usage as total bytes transferred - Handle multiple API naming variants
                                const download = client.txBytes ?? client.downstreamDataTransferredInBytes ?? client.dataTraffic?.downstreamDataTransferredInBytes ?? 0;
                                const upload = client.rxBytes ?? client.upstreamDataTransferredInBytes ?? client.dataTraffic?.upstreamDataTransferredInBytes ?? 0;
                                const totalData = download + upload;

                                return (
                                    <tr key={client.id || client.macAddress} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
                                                    {getClientIcon(client.osName || client.deviceType)}
                                                </div>
                                                <div>
                                                    <div className="text-white font-bold">{client.name || client.clientName || 'Unknown Client'}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{client.macAddress}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {isWired ? <Globe size={14} className="text-emerald-500" /> : <Wifi size={14} className="text-blue-500" />}
                                                    <span className="text-xs font-bold text-slate-300">
                                                        {isWired ? 'Wired' : 'Wireless'}
                                                        {client.port && <span className="ml-1 text-slate-500 font-mono">(Port {client.port})</span>}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Radio size={10} /> {client.connectedToDeviceName || 'Main Switch'}
                                                    {client.signalQuality && <span className="text-blue-400/80">({client.signalQuality}%)</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-xs font-black text-white px-2 py-0.5 bg-slate-800 rounded inline-block border border-white/5 w-fit">
                                                    {client.networkName || 'Default'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-bold ml-1">
                                                    VLAN {client.vlanId || '1'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                <div className="flex items-center gap-2 text-white font-black">
                                                    <Database size={14} className="text-indigo-400" />
                                                    {formatBytes(totalData)}
                                                </div>
                                                <div className="flex gap-3 text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                                                    <div className="flex items-center gap-0.5">
                                                        <ArrowDown size={10} className="text-emerald-500" /> {formatBytes(download)}
                                                    </div>
                                                    <div className="flex items-center gap-0.5">
                                                        <ArrowUp size={10} className="text-blue-500" /> {formatBytes(upload)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-200 font-mono text-xs font-bold">{client.ipAddress || 'DHCP Discovering...'}</div>
                                            <div className="text-slate-500 text-[10px] tracking-tight">{client.osName || client.deviceType || 'Standard Device'}</div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && filteredClients.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <Users size={48} className="mx-auto mb-4 opacity-10" />
                                        No active clients connected to this site.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Clients;
