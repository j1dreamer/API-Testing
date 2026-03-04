import React, { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Search, Network } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';
import { processWiredNetworks } from './dataProcessor';
import NetworkTable from './NetworkTable';
import WirelessTable from './WirelessTable';
import useIntervalFetch from '../../../hooks/useIntervalFetch';
import { useSettings } from '../../../context/SettingsContext';
import SyncIndicator from '../../../components/SyncIndicator';

const Networks = () => {
    const [networksData, setNetworksData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');   // 'all' | 'employee' | 'guest'
    const [sortConfig, setSortConfig] = useState({ key: 'vlan', direction: 'asc' });
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'wireless' | 'wired'

    const { selectedSiteId, sites, fetchSites } = useSite();
    const { isAutoRefreshEnabled } = useSettings();

    useEffect(() => {
        if (sites.length === 0) fetchSites();
    }, []);

    useEffect(() => {
        setNetworksData([]);
        if (selectedSiteId) fetchNetworks(selectedSiteId);
    }, [selectedSiteId]);

    const fetchNetworks = async (siteId, silent = false) => {
        if (!siteId) return;
        if (!silent) setLoading(true);
        else setIsRefreshing(true);
        setError('');
        try {
            // Single call — wirelessNetworks + wirelessClientsCount are embedded in the response
            const res = await apiClient.get(`/replay/api/sites/${siteId}/wiredNetworks`);
            const processed = processWiredNetworks(res.data);
            setNetworksData(processed);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Networks fetch error:', err);
            if (!silent) setError('Failed to synchronize network configurations.');
        } finally {
            if (!silent) setLoading(false);
            else setIsRefreshing(false);
        }
    };

    // 30s silent polling
    useIntervalFetch(() => {
        if (selectedSiteId && !loading) fetchNetworks(selectedSiteId, true);
    }, isAutoRefreshEnabled ? 30000 : null, [selectedSiteId, loading, isAutoRefreshEnabled]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredAndSortedData = useMemo(() => {
        let result = [...networksData];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(n =>
                n.name.toLowerCase().includes(q) ||
                String(n.vlanId).includes(q) ||
                n.ssids.some(s => s.name.toLowerCase().includes(q))
            );
        }

        if (typeFilter !== 'all') {
            result = result.filter(n => n.type?.toLowerCase() === typeFilter);
        }

        result.sort((a, b) => {
            let valA, valB;
            switch (sortConfig.key) {
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'vlan':
                    valA = Number(a.vlanId) || 0;
                    valB = Number(b.vlanId) || 0;
                    break;
                case 'type':
                    valA = a.type || '';
                    valB = b.type || '';
                    break;
                case 'clients':
                    valA = a.totalClients;
                    valB = b.totalClients;
                    break;
                case 'status':
                    valA = a.isEnabled ? 1 : 0;
                    valB = b.isEnabled ? 1 : 0;
                    break;
                default:
                    return 0;
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [networksData, searchTerm, typeFilter, sortConfig]);

    // Flatten SSIDs from wired network rows into wireless display rows
    const wirelessData = useMemo(() => {
        let rows = networksData.flatMap(net =>
            net.ssids.map(ssid => ({
                id:        `${net.id}-${ssid.id}`,
                name:      ssid.name,
                isEnabled: ssid.isEnabled,
                health:    'unknown',
                band:      ssid.band,
                security:  ssid.security,
                vlanId:    net.vlanId,
                clients:   ssid.clients,
                usage24h:  null,
            }))
        );

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            rows = rows.filter(r => r.name.toLowerCase().includes(q));
        }

        return rows;
    }, [networksData, searchTerm]);

    const totalClients = networksData.reduce((sum, n) => sum + n.totalClients, 0);
    const activeCount = networksData.filter(n => n.isEnabled).length;

    return (
        <div className="p-8 pb-32 font-sans overflow-hidden bg-slate-950 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight italic uppercase">Networks</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Wired &amp; wireless topology for {sites.find(s => s.siteId === selectedSiteId)?.siteName || 'current site'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <SyncIndicator isSyncing={loading || isRefreshing} lastUpdated={lastUpdated} />
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-slate-900 border border-white/5 rounded-2xl h-14 px-5 flex items-center gap-3 shadow-xl">
                    <Network size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {networksData.length} Networks
                    </span>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl h-14 px-5 flex items-center gap-3 shadow-xl">
                    <span className="relative flex h-2.5 w-2.5">
                        {activeCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {activeCount} Active
                    </span>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl h-14 px-5 flex items-center gap-3 shadow-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {totalClients} Total Clients
                    </span>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search network name, VLAN, or SSID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-slate-900 border border-white/5 rounded-2xl text-white text-sm focus:outline-none focus:border-indigo-500/50 shadow-inner transition-all hover:bg-slate-800/50"
                    />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-2xl p-1 shadow-xl">
                    {['all', 'wireless', 'wired'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                activeTab === tab
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* Wireless section */}
            {(activeTab === 'all' || activeTab === 'wireless') && (
                <div className="mb-8">
                    {activeTab === 'all' && (
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 px-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            Wireless Networks
                        </h2>
                    )}
                    <WirelessTable
                        data={wirelessData}
                        sortConfig={null}
                        onSort={null}
                        loading={loading}
                    />
                </div>
            )}

            {/* Wired section */}
            {(activeTab === 'all' || activeTab === 'wired') && (
                <div>
                    {activeTab === 'all' && (
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 px-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                            Wired Networks
                        </h2>
                    )}
                    <NetworkTable
                        data={filteredAndSortedData}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        loading={loading}
                    />
                </div>
            )}
        </div>
    );
};

export default Networks;
