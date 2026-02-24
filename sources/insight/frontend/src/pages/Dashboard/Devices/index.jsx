import { Monitor, Cpu, Network, Shield, Power, AlertCircle, ArrowRight, RefreshCw, Search, HardDrive, Wifi, Users, Database, ArrowDown, ArrowUp } from 'lucide-react';
import apiClient, { formatBytes } from '../../../api/apiClient';
import { useSite } from '../../../context/SiteContext';

const Devices = () => {
    const [devices, setDevices] = useState([]);
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
            fetchInventory(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchInventory = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/inventory`);
            console.log("Inventory Data:", res.data); // DEBUG LOG
            const data = res.data;
            if (Array.isArray(data)) {
                setDevices(data);
            } else if (data && data.elements) {
                setDevices(data.elements);
            } else if (data && data.devices) {
                setDevices(data.devices);
            } else {
                setDevices([]);
            }
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

    const filteredDevices = (devices || []).filter(d => {
        if (!d) return false;
        return (
            (d.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.model || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.ipAddress || "").toString().includes(searchTerm) ||
            (d.macAddress || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const getDeviceIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'accesspoint': return <Wifi size={18} className="text-blue-500" />;
            case 'switch': return <HardDrive size={18} className="text-indigo-500" />;
            case 'gateway': return <Shield size={18} className="text-emerald-500" />;
            default: return <Monitor size={18} className="text-slate-400" />;
        }
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Devices</h1>
                    <p className="text-sm text-slate-400 mt-1">Inventory management for {sites.find(s => s.siteId === selectedSiteId)?.siteName || 'Site'}</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Filter devices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-12 pl-10 pr-4 bg-black/40 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 w-full md:w-64 shadow-inner"
                        />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
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
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Device Name</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Model / Serial</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">IP / MAC Address</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Usage</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Clients</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                            {filteredDevices.map((device) => {
                                const isUp = device.status === 'up' || device.connectionState === 'connected' || device.state?.toLowerCase() === 'online';
                                // Common Aruba fields for throughput
                                const download = device.downloadSpeed || device.txBytes || 0;
                                const upload = device.uploadSpeed || device.rxBytes || 0;

                                return (
                                    <tr key={device.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                                                    {getDeviceIcon(device.deviceType)}
                                                </div>
                                                <div>
                                                    <div className="text-white font-bold tracking-tight">{device.name || 'Unnamed'}</div>
                                                    <div className="text-[10px] text-slate-500 uppercase tracking-tighter font-black">{device.deviceType}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-xs">{device.model || 'Generic Device'}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{device.serialNumber || 'SN: Unknown'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-blue-400 font-mono text-[11px] font-bold">{device.ipAddress || '0.0.0.0'}</div>
                                            <div className="text-slate-500 font-mono text-[9px] uppercase">{device.macAddress}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isUp ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                                                {device.status || device.state || 'offline'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 w-24">
                                                {(() => {
                                                    const download = device.txBytes ?? device.downstreamDataTransferredInBytes ?? device.dataTraffic?.downstreamDataTransferredInBytes ?? 0;
                                                    const upload = device.rxBytes ?? device.upstreamDataTransferredInBytes ?? device.dataTraffic?.upstreamDataTransferredInBytes ?? 0;
                                                    const totalData = download + upload;

                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-1.5 text-white font-black text-[10px]">
                                                                <Database size={12} className="text-indigo-400" />
                                                                {formatBytes(totalData)}
                                                            </div>
                                                            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-500">
                                                                <div className="flex items-center gap-0.5 text-emerald-500">
                                                                    <ArrowDown size={8} /> {formatBytes(download)}
                                                                </div>
                                                                <div className="flex items-center gap-0.5 text-blue-500">
                                                                    <ArrowUp size={8} /> {formatBytes(upload)}
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5 font-black text-white bg-slate-800 border border-white/5 rounded-lg px-3 py-1 text-xs">
                                                <Users size={12} className="text-slate-500" />
                                                {device.connectedClients || device.wiredClientsCount || 0}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && filteredDevices.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        <Monitor size={48} className="mx-auto mb-4 opacity-10" />
                                        No devices found in this site.
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
