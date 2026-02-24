import React, { useState, useEffect } from 'react';
import { Wifi, Globe, Shield, Lock, Bell, Activity, RefreshCw, AlertCircle, Cpu, WifiOff, List, Link } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';

const Networks = () => {
    const [networks, setNetworks] = useState([]);
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
        if (selectedSiteId) {
            fetchNetworks(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchNetworks = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/networksSummary`);
            console.log("Networks Data:", res.data); // DEBUG LOG
            const data = res.data;
            if (Array.isArray(data)) {
                setNetworks(data);
            } else if (data && data.elements) {
                setNetworks(data.elements);
            } else if (data && data.networks) {
                setNetworks(data.networks);
            } else {
                setNetworks([]);
            }
        } catch (err) {
            console.error("Networks fetch error:", err);
            setError("Failed to fetch network configurations.");
        } finally {
            setLoading(false);
        }
    };

    const getAuthLabel = (net) => {
        if (net.authentication === 'GUEST') return 'Guest Portal';
        if (net.security === 'OPEN') return 'Open';
        if (net.security === 'PSK' || net.security === 'WPA2_PSK') return 'WPA2/WPA3 PSK';
        if (net.security === 'ENTERPRISE') return 'Enterprise (802.1X)';
        return net.security || 'Custom';
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Networks</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Deployment for {selectedSite ? selectedSite.siteName : 'selected site'}
                    </p>
                </div>

                <button
                    onClick={() => fetchNetworks(selectedSiteId)}
                    disabled={loading || !selectedSiteId}
                    className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {networks.map((net) => (
                    <div key={net.id || net.networkId} className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-white/5 group hover:border-indigo-500/30 transition-all hover:translate-y-[-4px]">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-4 bg-slate-800 rounded-2xl border border-white/5 shadow-inner text-indigo-400 group-hover:scale-110 transition-transform">
                                {net.isWireless ? <Wifi size={24} /> : <Link size={24} />}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${net.isEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                {net.isEnabled ? 'Active' : 'Disabled'}
                            </span>
                        </div>

                        <h2 className="text-xl font-bold text-white mb-1">{net.networkName || 'SSID'}</h2>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-6">
                            <Globe size={12} />
                            VLAN {net.vlanId || 'Native'}
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                                <span className="text-xs text-slate-400 flex items-center gap-2">
                                    <Shield size={14} /> Security
                                </span>
                                <span className="text-xs font-bold text-white">{getAuthLabel(net)}</span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                                <span className="text-xs text-slate-400 flex items-center gap-2">
                                    <Cpu size={14} /> Bands
                                </span>
                                <span className="text-xs font-bold text-white">
                                    {net.isAvailableOn24GHzRadioBand ? '2.4' : ''}
                                    {net.isAvailableOn5GHzRadioBand ? (net.isAvailableOn24GHzRadioBand ? ' + 5' : '5') : ''}
                                    {net.isAvailableOn6GHzRadioBand ? ' + 6' : ''} GHz
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {!loading && networks.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-900 border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center opacity-50">
                        <WifiOff size={48} className="mb-4" />
                        <h3 className="text-xl font-bold text-white">No Networks Yet</h3>
                        <p className="text-sm text-slate-500 max-w-xs">Configure your first Wi-Fi or Wired network to see it here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Networks;
