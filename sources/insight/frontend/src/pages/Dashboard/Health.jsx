import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, ArrowRight, Users, Wifi, Monitor, CheckCircle, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../../api/apiClient';
import { useSite } from '../../context/SiteContext';

const Health = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    useEffect(() => {
        if (selectedSiteId) {
            fetchHealthData(selectedSiteId);
        }
    }, [selectedSiteId]);

    const fetchHealthData = async (siteId) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/proxy/api/sites/${siteId}/health`);
            setData(res.data);
        } catch (err) {
            console.error("Health fetch error:", err);
            setError("Failed to fetch health data. Check backend logs or session active status.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (selectedSiteId) fetchHealthData(selectedSiteId);
        else fetchSites();
    };

    // Processing Chart Data
    const chartData = (data?.historicalHealths || []).map(h => ({
        time: new Date(h.sampleTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: h.health?.healthScore?.score || 0,
        severity: h.health?.healthScore?.scoreSeverity || 'none'
    })).reverse();

    // Processing Conditions Table Data
    const conditionsList = [];
    if (data?.currentHealth) {
        Object.entries(data.currentHealth).forEach(([key, val]) => {
            if (val?.conditions && Array.isArray(val.conditions)) {
                val.conditions.forEach(c => {
                    conditionsList.push({
                        ...c,
                        sourceType: key.charAt(0).toUpperCase() + key.slice(1).replace(/s$/, ''),
                    });
                });
            }
        });
    }

    const currentScore = data?.currentHealth?.healthScore?.score || 0;
    const scoreColor = currentScore >= 80 ? 'text-emerald-500' : currentScore >= 60 ? 'text-yellow-500' : 'text-rose-500';

    const getCounterBox = (title, icon, counters) => {
        const { goodCount = 0, fairCount = 0, poorCount = 0, noneCount = 0 } = counters || {};
        const total = goodCount + fairCount + poorCount + noneCount;

        return (
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-white/5 relative overflow-hidden flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2 text-slate-300 font-bold">
                    {title}
                </div>
                <div className="flex items-center justify-center gap-3">
                    <div className="text-xl font-bold text-white flex items-center gap-2">
                        {total}
                    </div>
                </div>
                <div className="flex gap-4 mt-4 text-xs font-bold text-slate-400">
                    {poorCount > 0 && <span className="flex items-center gap-1 text-rose-500"><div className="w-2 h-2 rounded-full bg-rose-500"></div> {poorCount} Poor</span>}
                    {fairCount > 0 && <span className="flex items-center gap-1 text-yellow-500"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> {fairCount} Fair</span>}
                    {goodCount > 0 && <span className="flex items-center gap-1 text-emerald-500"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {goodCount} Good</span>}
                    {noneCount > 0 && <span className="flex items-center gap-1 text-slate-500"><div className="w-2 h-2 rounded-full bg-slate-500"></div> {noneCount} None</span>}
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Health</h1>
                    <p className="text-sm text-slate-400 mt-1">Live health metrics from selected site</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            disabled={loading || sites.length === 0}
                            className="w-full h-12 bg-black/40 border border-white/5 rounded-xl px-5 text-white text-sm font-bold appearance-none focus:outline-none focus:border-emerald-500/50 shadow-inner disabled:opacity-50"
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
                        className="h-12 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
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

            {/* Main Graph Area */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-white/5 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-300">Health Trend</h2>
                        {data && (
                            <div className="flex items-center gap-3 mt-1">
                                <span className={`text-4xl font-black ${scoreColor}`}>{currentScore}%</span>
                                <span className="text-sm text-slate-400 uppercase tracking-widest font-bold">Score</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-64 mt-4 w-full">
                    {loading && !data ? (
                        <div className="flex justify-center items-center h-full text-slate-500">Loading chart data...</div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `${val}%`}
                                    domain={[0, 100]}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                    itemStyle={{ color: '#10b981' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, fill: '#10b981' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex justify-center items-center h-full text-slate-500">No health history available.</div>
                    )}
                </div>
            </div>

            {/* Counters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {getCounterBox('Clients', <Users size={20} />, data?.currentHealth?.clients?.counters)}
                {getCounterBox('Networks', <Wifi size={20} />, data?.currentHealth?.networks?.counters)}
                {getCounterBox('Devices', <Monitor size={20} />, data?.currentHealth?.devices?.counters)}
            </div>

            {/* Conditions Table */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-300">{conditionsList.length} Items</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-800/50 text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-bold">Condition</th>
                                <th className="px-6 py-4 font-bold">Source Type</th>
                                <th className="px-6 py-4 font-bold">Source</th>
                                <th className="px-6 py-4 font-bold">Severity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                            {conditionsList.map((item, idx) => {
                                const isMajor = item.conditionSeverity === 'major' || item.severity === 'poor';
                                const severityLabel = item.conditionSeverity || item.severity || 'Unknown';

                                // Format camelCase condition strings
                                const formattedCondition = item.condition.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                                return (
                                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 text-white font-bold tracking-tight">{formattedCondition}</td>
                                        <td className="px-6 py-4 text-slate-400">{item.sourceType}</td>
                                        <td className="px-6 py-4">{item.name || item.id}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isMajor ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                <div className={`w-2 h-2 rounded-full ${isMajor ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                                {severityLabel}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {!loading && conditionsList.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                                        No conditions detected. Everything looks good!
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

export default Health;
