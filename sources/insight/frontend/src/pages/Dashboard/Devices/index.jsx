import React, { useState, useMemo, useEffect } from 'react';
import { Monitor, Cpu, Network, Shield, Power, AlertCircle, ArrowRight, RefreshCw, Search, HardDrive, Wifi, Users, Database, ArrowDown, ArrowUp, Circle, Globe, Laptop } from 'lucide-react';
import apiClient, { formatBytes } from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [healthFilter, setHealthFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const { selectedSiteId, sites, fetchSites } = useSite();

    useEffect(() => {
        if (sites.length === 0) fetchSites();
    }, []);

    useEffect(() => {
        if (selectedSiteId) fetchInventory(selectedSiteId);
    }, [selectedSiteId]);

    const fetchInventory = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/inventory`);
            const data = res.data;
            let extracted = [];
            if (Array.isArray(data)) extracted = data;
            else if (data.elements) extracted = data.elements;
            else if (data.devices) extracted = data.devices;

            setDevices(extracted || []);
        } catch (err) {
            console.error("Inventory fetch error:", err);
            if (err.response?.status !== 401) {
                setError("Failed to fetch device inventory.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (selectedSiteId) fetchInventory(selectedSiteId);
    };

    const formatUptime = (seconds) => {
        if (!seconds || seconds < 0) return '0 min';
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);

        let parts = [];
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);

        if (parts.length === 0) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} min`;
        }
        return parts.join(', ');
    };

    const getHealthInfo = (device) => {
        const isUp = (device.status || device.state || "").toLowerCase() === 'up';
        const health = (device.health || (isUp ? 'good' : 'poor')).toLowerCase();

        let color = 'bg-slate-500';
        let textClass = 'text-slate-500';

        if (health === 'good') { color = 'bg-emerald-500'; textClass = 'text-emerald-500'; }
        else if (health === 'fair') { color = 'bg-amber-500'; textClass = 'text-amber-500'; }
        else if (health === 'poor') { color = 'bg-rose-500'; textClass = 'text-rose-500'; }

        return { color, textClass, health, status: isUp ? 'Online' : 'Offline' };
    };

    const getInterfaceContent = (device) => {
        const type = device.deviceType?.toLowerCase();
        if (type === 'switch' || type === 'gateway') {
            const uplinkPort = device.ethernetPorts?.find(p => p.isUplink)?.portNumber;
            return {
                main: uplinkPort ? `Uplink: Port ${uplinkPort}` : 'No Uplink',
                sub: `${device.wiredClientsCount || 0} clients`
            };
        }
        if (type === 'accesspoint') {
            const bands = device.radios?.map(r => r.wirelessBand?.toLowerCase().replace('ghz', ' GHz')).join(', ') || 'No Radios';
            return {
                main: bands,
                sub: `${device.connectedClients || 0} clients`
            };
        }
        return { main: '-', sub: '' };
    };

    const processedDevices = useMemo(() => {
        let result = [...(devices || [])];

        // Filtering
        result = result.filter(d => {
            if (!d) return false;

            const name = d.name || d.defaultName || d.macAddress || "";
            const matchesSearch =
                name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.model || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.ipAddress || "").toString().includes(searchTerm);

            const matchesType = typeFilter === 'all' || d.deviceType?.toLowerCase() === typeFilter;

            const isUp = (d.status || d.state || "").toLowerCase() === 'up';
            const health = (d.health || (isUp ? 'good' : 'poor')).toLowerCase();
            const matchesHealth = healthFilter === 'all' || health === healthFilter;

            return matchesSearch && matchesType && matchesHealth;
        });

        // Sorting
        result.sort((a, b) => {
            let valA, valB;
            switch (sortConfig.key) {
                case 'name':
                    valA = (a.name || a.defaultName || a.macAddress || "").toLowerCase();
                    valB = (b.name || b.defaultName || b.macAddress || "").toLowerCase();
                    break;
                case 'type':
                    valA = (a.deviceType || "").toLowerCase();
                    valB = (b.deviceType || "").toLowerCase();
                    break;
                case 'health':
                    const p = { good: 3, fair: 2, poor: 1, '': 0 };
                    const isUpA = (a.status || a.state || "").toLowerCase() === 'up';
                    const isUpB = (b.status || b.state || "").toLowerCase() === 'up';
                    valA = p[(a.health || (isUpA ? 'good' : 'poor')).toLowerCase()] ?? 0;
                    valB = p[(b.health || (isUpB ? 'good' : 'poor')).toLowerCase()] ?? 0;
                    break;
                case 'ip':
                    valA = (a.ipAddress || "").toLowerCase();
                    valB = (b.ipAddress || "").toLowerCase();
                    break;
                case 'uptime':
                    valA = a.uptimeInSeconds || 0;
                    valB = b.uptimeInSeconds || 0;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [devices, searchTerm, typeFilter, healthFilter, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ArrowDown size={12} className="opacity-20 ml-1 inline" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={12} className="text-blue-500 ml-1 inline" /> :
            <ArrowDown size={12} className="text-blue-500 ml-1 inline" />;
    };

    const getDeviceIcon = (d) => {
        const type = d.deviceType?.toLowerCase();
        if (type === 'accesspoint') return <Wifi size={18} />;
        if (type === 'switch') return <HardDrive size={18} />;
        return <Shield size={18} />;
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Infrastructure</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Network devices at {sites.find(s => s.siteId === selectedSiteId)?.siteName || 'current site'}
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={() => fetchInventory(selectedSiteId)}
                        disabled={loading}
                        className="h-12 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, model, or IP..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-800 dark:text-white text-sm focus:outline-none focus:border-purple-500/50 shadow-inner"
                    />
                </div>

                <div className="flex gap-3">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl px-5 text-slate-800 dark:text-white text-sm font-bold focus:outline-none focus:border-purple-500/50 appearance-none min-w-[150px]"
                    >
                        <option value="all">All Types</option>
                        <option value="accesspoint">Access Points</option>
                        <option value="switch">Switches</option>
                    </select>

                    <select
                        value={healthFilter}
                        onChange={(e) => setHealthFilter(e.target.value)}
                        className="h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl px-5 text-slate-800 dark:text-white text-sm font-bold focus:outline-none focus:border-purple-500/50 appearance-none min-w-[150px]"
                    >
                        <option value="all">All Health</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-b border-slate-200 dark:border-white/5">
                            <tr>
                                <th onClick={() => handleSort('name')} className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group">
                                    Device <SortIcon column="name" />
                                </th>
                                <th onClick={() => handleSort('type')} className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group">
                                    Type <SortIcon column="type" />
                                </th>
                                <th onClick={() => handleSort('health')} className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group">
                                    Health <SortIcon column="health" />
                                </th>
                                <th onClick={() => handleSort('ip')} className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group">
                                    IP Address <SortIcon column="ip" />
                                </th>
                                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Interface / Radio</th>
                                <th onClick={() => handleSort('uptime')} className="px-6 py-5 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group text-right">
                                    Uptime <SortIcon column="uptime" />
                                </th>
                                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-right">Clients</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                            {processedDevices.map((device) => {
                                const hInfo = getHealthInfo(device);
                                const iContent = getInterfaceContent(device);
                                const name = device.name || device.defaultName || device.macAddress;
                                const model = device.model || 'Unknown Model';

                                return (
                                    <tr key={device.id || device.macAddress} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-white/5 group-hover:border-purple-300 dark:group-hover:border-purple-500/30 transition-colors">
                                                    {getDeviceIcon(device)}
                                                </div>
                                                <div>
                                                    <div className="text-slate-800 dark:text-white font-bold tracking-tight">{name}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono uppercase truncate max-w-[150px]" title={device.macAddress}>{device.macAddress}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{device.deviceType === 'accesspoint' ? 'Access Point' : 'Switch'}</div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{model}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${hInfo.color} shadow-[0_0_8px] shadow-current`}></div>
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${hInfo.textClass}`}>
                                                        {hInfo.health}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 font-bold">{hInfo.status}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">{device.ipAddress || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{iContent.main}</div>
                                            <div className="text-[10px] text-slate-500 italic mt-0.5">{iContent.sub}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {formatUptime(device.uptimeInSeconds)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-slate-800 dark:text-white font-black text-xs">
                                                {device.connectedClients || device.wiredClientsCount || 0}
                                            </div>
                                            <div className="text-[8px] text-slate-500 font-bold uppercase">Connected</div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && processedDevices.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center text-slate-500 bg-slate-50 dark:bg-black/10">
                                        <div className="flex flex-col items-center">
                                            <HardDrive size={48} className="mb-4 opacity-5" />
                                            <p className="text-lg font-black text-slate-700 uppercase tracking-widest">No devices found</p>
                                            <p className="text-xs text-slate-600 mt-2">Try adjusting your filters</p>
                                        </div>
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

export default Devices;
