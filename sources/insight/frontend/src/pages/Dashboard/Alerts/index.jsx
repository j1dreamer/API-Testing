import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, AlertCircle, RefreshCw, Filter, Calendar, MapPin } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { selectedSiteId, sites, fetchSites } = useSite();

    const selectedSite = sites.find(s => s.siteId === selectedSiteId);

    useEffect(() => {
        if (sites.length === 0) {
            fetchSites();
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [selectedSiteId]);

    const fetchAlerts = async () => {
        setLoading(true);
        setError('');
        try {
            // Global alerts might require filtering on frontend to match selected site
            const res = await apiClient.get('/proxy/api/globalAlerts');
            const allAlerts = res.data.elements || [];

            // Filter by site if selected
            if (selectedSite) {
                const siteName = (selectedSite.siteName || selectedSite.name || "").toLowerCase();
                const siteId = selectedSite.siteId || selectedSite.id;

                setAlerts(allAlerts.filter(a =>
                    (a.siteName && a.siteName.toLowerCase() === siteName) ||
                    (a.siteId === siteId)
                ));
            } else {
                setAlerts(allAlerts);
            }
        } catch (err) {
            console.error("Alerts fetch error:", err);
            setError("Failed to fetch alerts.");
        } finally {
            setLoading(false);
        }
    };

    const getSeverityStyles = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'major':
            case 'critical':
                return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'minor':
            case 'warning':
                return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            default:
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Active Alerts</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Monitoring {selectedSite ? selectedSite.siteName : 'all sites'}
                    </p>
                </div>

                <button
                    onClick={fetchAlerts}
                    disabled={loading}
                    className="h-12 px-6 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'SYNCING...' : 'REFRESH'}
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            <div className="space-y-4">
                {alerts.map((alert) => (
                    <div key={alert.id} className={`p-5 rounded-2xl border transition-all hover:translate-x-1 ${getSeverityStyles(alert.severity)}`}>
                        <div className="flex gap-4">
                            <div className="mt-1">
                                {alert.severity?.toLowerCase() === 'major' ? <AlertTriangle size={24} /> : <Info size={24} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-lg">{alert.alertTypeLocalized || alert.alertType}</h3>
                                    <span className="text-xs font-bold opacity-60 flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(alert.timestamp * 1000).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm mt-1 opacity-80">{alert.descriptionLocalized || alert.description}</p>

                                <div className="flex gap-4 mt-4">
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest opacity-60">
                                        <MapPin size={10} />
                                        {alert.siteName}
                                    </div>
                                    {alert.deviceName && (
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest opacity-60">
                                            <AlertCircle size={10} />
                                            {alert.deviceName}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {!loading && alerts.length === 0 && (
                    <div className="bg-slate-900 rounded-3xl p-20 border border-white/5 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Bell size={40} className="opacity-40" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">All Quiet!</h2>
                        <p className="text-slate-500 max-w-xs">There are no active alerts for the selected site at this moment.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Alerts;
