import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, Bell, Users, Wifi, Monitor, AlertCircle, ChevronLeft } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useSite } from '../../context/SiteContext';
import useIntervalFetch from '../../hooks/useIntervalFetch';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import SyncIndicator from '../../components/SyncIndicator';
import ApplicationSummaryCard from './Applications/ApplicationSummaryCard';

const SiteDetail = () => {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { isAutoRefreshEnabled } = useSettings();
    const { sites, setSelectedSiteId, fetchSites } = useSite();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    // Sync selectedSiteId so sidebar pages know which site is active
    useEffect(() => {
        if (siteId) {
            setSelectedSiteId(siteId);
        }
    }, [siteId]);

    // Make sure sites are loaded (needed for site name display)
    useEffect(() => {
        if (sites.length === 0) fetchSites();
    }, []);

    const site = sites.find(s => (s.siteId || s.id || s._id) === siteId);
    const siteName = site?.siteName || site?.name || siteId;

    const fetchDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/dashboard`);
            setData(res.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            if (!silent) setError(t('dashboard.error_fetch'));
        } finally {
            if (!silent) setLoading(false);
            else setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (siteId) fetchDashboardData();
    }, [siteId]);

    useIntervalFetch(() => {
        if (siteId && !loading) fetchDashboardData(true);
    }, isAutoRefreshEnabled ? 60000 : null, [siteId, loading, isAutoRefreshEnabled]);

    const healthScore = data?.healthOverview?.currentScore?.score ?? 'N/A';
    const activeAlerts =
        (data?.alertsOverview?.activeMajorAlertsCount || 0) +
        (data?.alertsOverview?.activeMinorAlertsCount || 0) +
        (data?.alertsOverview?.activeInfoAlertsCount || 0);
    const connectedClients = data?.clientsOverview?.totalClient?.total || 0;
    const activeNetworks =
        (data?.networksOverview?.wirelessNetworks || 0) +
        (data?.networksOverview?.wiredNetworks || 0) +
        (data?.networksOverview?.vpnNetworks || 0);
    const onlineDevices =
        (data?.devicesOverview?.accessPoints?.online || 0) +
        (data?.devicesOverview?.switches?.online || 0) +
        (data?.devicesOverview?.stacks?.online || 0) +
        (data?.devicesOverview?.wifiRouters?.online || 0) +
        (data?.devicesOverview?.gateways?.online || 0);

    const cards = [
        {
            key: 'health',
            label: t('dashboard.network_health'),
            icon: <Activity className="text-emerald-500" size={24} />,
            value: healthScore,
            route: '/health',
        },
        {
            key: 'alerts',
            label: t('dashboard.active_alerts'),
            icon: <Bell className="text-rose-500" size={24} />,
            value: activeAlerts,
            route: '/alerts',
        },
        {
            key: 'clients',
            label: t('dashboard.connected_clients'),
            icon: <Users className="text-blue-500" size={24} />,
            value: connectedClients,
            route: '/clients',
        },
        {
            key: 'networks',
            label: t('dashboard.total_networks'),
            icon: <Wifi className="text-indigo-500" size={24} />,
            value: activeNetworks,
            route: '/networks',
        },
        {
            key: 'devices',
            label: t('dashboard.online_devices'),
            icon: <Monitor className="text-purple-500" size={24} />,
            value: onlineDevices,
            route: '/devices',
        },
    ];

    return (
        <div className="p-8 pb-32">
            {/* Back + Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <button
                        onClick={() => navigate('/overview')}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-2 transition-colors"
                    >
                        <ChevronLeft size={16} />
                        Back to Sites
                    </button>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                        {siteName}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('dashboard.subtitle')}
                    </p>
                </div>

                <SyncIndicator isSyncing={loading || isRefreshing} lastUpdated={lastUpdated} />
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* Metric cards — each clickable */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {cards.map(card => (
                    <div
                        key={card.key}
                        onClick={() => navigate(card.route)}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-white/5 relative overflow-hidden group hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col justify-between"
                    >
                        <div className="absolute -right-6 -top-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                            {card.icon}
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner">
                                {card.icon}
                            </div>
                            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                {card.label}
                            </h2>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter transition-all">
                                {loading && !data ? '...' : card.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Application Summary */}
            <div className="w-full">
                <ApplicationSummaryCard dashboardData={data} loading={loading} />
            </div>
        </div>
    );
};

export default SiteDetail;
