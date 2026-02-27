import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';

const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/admin/logs');
            setLogs(res.data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch logs", err);
            // Fallback message depending on where auth check failed.
            if (err.response && err.response.status === 403) {
                setError("Access Denied: You must be an administrator to view this page.");
            } else {
                setError("Failed to fetch audit logs.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-red-500 font-semibold">{error}</div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
                <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-700 rounded-lg text-sm hover:bg-slate-700 transition"
                >
                    Refresh
                </button>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Timestamp (GMT+7)</th>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Actor Email</th>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Action</th>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Method</th>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Endpoint</th>
                            <th scope="col" className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {logs.length > 0 ? logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.timestamp}</td>
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{log.actor_email}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-semibold">
                                        {log.action || "API_CALL"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${log.method === 'GET' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                                            log.method === 'POST' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' :
                                                log.method === 'DELETE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800'}`}
                                    >
                                        {log.method}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{log.endpoint}</td>
                                <td className="px-6 py-4">
                                    <span className={log.statusCode >= 400 ? "text-rose-500 font-bold" : "text-emerald-500 font-bold"}>
                                        {log.statusCode}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                    No audit logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminLogs;
