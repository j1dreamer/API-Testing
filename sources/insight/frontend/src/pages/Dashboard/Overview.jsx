import React, { useState, useEffect } from 'react';
import { Activity, Bell, Users, Wifi, Monitor, Box, AlertCircle, ArrowRight } from 'lucide-react';
import apiClient from '../../api/apiClient';

const Overview = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Site selection state
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState('');

    useEffect(() => {
        fetchSites();
    }, []);

    // Fetch dashboard when a new site is selected
    useEffect(() => {
        if (selectedSiteId) {
            fetchDashboardData(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchSites = async () => {
        setLoading(true);
        setError('');
        try {
            const sitesRes = await apiClient.get('/cloner/live-sites');
            const fetchedSites = Array.isArray(sitesRes.data) ? sitesRes.data : [];
            if (fetchedSites.length === 0) {
                throw new Error("No sites found. Ensure the backend has a valid session.");
            }
            setSites(fetchedSites);
            // Default to the first site
            setSelectedSiteId(fetchedSites[0].siteId || fetchedSites[0]._id || fetchedSites[0].id);
        } catch (err) {
            console.error("Sites fetch error:", err);
            setError(err.response?.data?.detail || "Failed to fetch sites list.");
            setLoading(false);
        }
    };

    const fetchDashboardData = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/dashboard`);
            setData(res.data);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            setError("Failed to fetch dashboard data. Check backend logs or session active status.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (selectedSiteId) fetchDashboardData(selectedSiteId);
        else fetchSites();
    };

    const healthScore = data?.healthOverview?.currentScore?.score ?? 'N/A';
    const activeAlerts = (data?.alertsOverview?.activeMajorAlertsCount || 0) + (data?.alertsOverview?.activeMinorAlertsCount || 0) + (data?.alertsOverview?.activeInfoAlertsCount || 0);
    const connectedClients = data?.clientsOverview?.totalClient?.total || 0;
    const activeNetworks = (data?.networksOverview?.wirelessNetworks || 0) + (data?.networksOverview?.wiredNetworks || 0) + (data?.networksOverview?.vpnNetworks || 0);
    const onlineDevices = (data?.devicesOverview?.accessPoints?.online || 0) +
        (data?.devicesOverview?.switches?.online || 0) +
        (data?.devicesOverview?.stacks?.online || 0) +
        (data?.devicesOverview?.wifiRouters?.online || 0) +
        (data?.devicesOverview?.gateways?.online || 0);

    const cards = [
        { key: 'health', label: 'Network Health', icon: <Activity className="text-emerald-500" size={24} />, value: healthScore },
        { key: 'alerts', label: 'Active Alerts', icon: <Bell className="text-rose-500" size={24} />, value: activeAlerts },
        { key: 'clients', label: 'Connected Clients', icon: <Users className="text-blue-500" size={24} />, value: connectedClients },
        { key: 'networks', label: 'Total Networks', icon: <Wifi className="text-indigo-500" size={24} />, value: activeNetworks },
        { key: 'devices', label: 'Online Devices', icon: <Monitor className="text-purple-500" size={24} />, value: onlineDevices },
        { key: 'applications', label: 'Tracked Apps', icon: <Box className="text-orange-500" size={24} />, value: 'N/A' }
    ];

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Dashboard Overview</h1>
                    <p className="text-sm text-slate-400 mt-1">Live metrics from selected site</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Site Selector Dropdown */}
                    <div className="relative flex-1 md:w-72">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            disabled={loading || sites.length === 0}
                            className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-5 text-white text-sm font-bold appearance-none focus:outline-none focus:border-blue-500/50 shadow-inner disabled:opacity-50"
                        >
                            <option value="" disabled>-- Select Site --</option>
                            {sites.map(site => (
                                <option key={site.siteId || site._id || site.id} value={site.siteId || site._id || site.id} className="bg-slate-900">
                                    {site.siteName || site.name || 'Unnamed Site'}
                                </option>
                            ))}
                        </select>
                        <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map(card => (
                    <div key={card.key} className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute -right-6 -top-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            {card.icon}
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-slate-800 rounded-xl border border-white/5 shadow-inner">
                                {card.icon}
                            </div>
                            <h2 className="text-sm font-bold text-slate-400">{card.label}</h2>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white tracking-tighter">
                                {loading && !data ? '...' : card.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Overview;
