import React, { useState, useEffect } from 'react';
import { Activity, Bell, Users, Wifi, Monitor, Box, AlertCircle, ArrowRight } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useSite } from '../../context/SiteContext';
import useIntervalFetch from '../../hooks/useIntervalFetch';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import SyncIndicator from '../../components/SyncIndicator';
import ApplicationSummaryCard from './Applications/ApplicationSummaryCard';

const Overview = () => {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const { isAutoRefreshEnabled } = useSettings();
    const {
        selectedSiteId,
        setSelectedSiteId,
        sites,
        fetchSites
    } = useSite();

    useEffect(() => {
        if (sites.length === 0) {
            fetchSites();
        }
    }, []);

    // Fetch dashboard when a new site is selected
    useEffect(() => {
        if (selectedSiteId) {
            fetchDashboardData(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchDashboardData = async (siteId, silent = false) => {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);

        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/dashboard`);
            setData(res.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            if (!silent) setError(t('dashboard.error_fetch'));
        } finally {
            if (!silent) setLoading(false);
            else setIsRefreshing(false);
        }
    };

    useIntervalFetch(() => {
        if (selectedSiteId && !loading) {
            fetchDashboardData(selectedSiteId, true);
        }
    }, isAutoRefreshEnabled ? 60000 : null, [selectedSiteId, loading, isAutoRefreshEnabled]);

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
        { key: 'health', label: t('dashboard.network_health'), icon: <Activity className="text-emerald-500" size={24} />, value: healthScore },
        { key: 'alerts', label: t('dashboard.active_alerts'), icon: <Bell className="text-rose-500" size={24} />, value: activeAlerts },
        { key: 'clients', label: t('dashboard.connected_clients'), icon: <Users className="text-blue-500" size={24} />, value: connectedClients },
        { key: 'networks', label: t('dashboard.total_networks'), icon: <Wifi className="text-indigo-500" size={24} />, value: activeNetworks },
        { key: 'devices', label: t('dashboard.online_devices'), icon: <Monitor className="text-purple-500" size={24} />, value: onlineDevices }
    ];

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('dashboard.title')}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Site Selector Dropdown */}
                    <div className="relative flex-1 md:w-72">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            disabled={loading || sites.length === 0}
                            className="w-full h-12 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl px-5 text-slate-800 dark:text-white text-sm font-bold appearance-none focus:outline-none focus:border-blue-500/50 shadow-inner disabled:opacity-50 transition-colors"
                        >
                            <option value="" disabled>{t('dashboard.select_site')}</option>
                            {sites.map(site => (
                                <option key={site.siteId || site._id || site.id} value={site.siteId || site._id || site.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                                    {site.siteName || site.name || t('dashboard.unnamed_site')}
                                </option>
                            ))}
                        </select>
                        <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 rotate-90 pointer-events-none" size={16} />
                    </div>

                    <SyncIndicator isSyncing={loading || isRefreshing} lastUpdated={lastUpdated} />
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {cards.map(card => (
                    <div key={card.key} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-white/5 relative overflow-hidden group hover:border-slate-200 dark:hover:border-white/10 transition-colors h-full flex flex-col justify-between">
                        <div className="absolute -right-6 -top-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            {card.icon}
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner">
                                {card.icon}
                            </div>
                            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400">{card.label}</h2>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter transition-all">
                                {loading && !data ? '...' : card.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Row 4: Application Card (1 thẻ / hàng) */}
            <div className="w-full">
                <ApplicationSummaryCard dashboardData={data} loading={loading} />
            </div>
        </div>
    );
};

export default Overview;
