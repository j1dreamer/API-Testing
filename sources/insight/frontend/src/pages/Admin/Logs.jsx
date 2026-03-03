import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, AlertCircle, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import apiClient from '../../api/apiClient';

// ---------------------------------------------------------------------------
// internalWebRole options — these control INSIGHT dashboard access ONLY.
// They have NO connection to the user's role on Aruba Instant On cloud devices.
// ---------------------------------------------------------------------------
const INTERNAL_WEB_ROLES = ['admin', 'operator', 'viewer', 'user', 'guest'];

const ROLE_STYLE = {
    admin:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
    operator: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    viewer:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    user:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    guest:    'bg-slate-700 text-slate-400 border-white/5',
};

// ── Logs Tab ─────────────────────────────────────────────────────────────────

const LogsTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/admin/logs');
            setLogs(res.data);
        } catch (err) {
            setError(err.response?.status === 403
                ? 'Access Denied: Admin role required.'
                : 'Failed to fetch audit logs.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const METHOD_STYLE = {
        GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        POST:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
        PUT:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
        DELETE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        </div>
    );

    if (error) return (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
        </div>
    );

    return (
        <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[900px] text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-800/60 border-b border-white/5 sticky top-0 z-10">
                        <tr>
                            {['Timestamp (GMT+7)', 'Actor Email', 'Action', 'Method', 'Endpoint', 'Status'].map(h => (
                                <th key={h} className="px-5 py-4 font-black uppercase tracking-widest text-[9px] text-slate-400">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-slate-300">
                        {logs.length > 0 ? logs.map(log => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-5 py-3.5 font-mono text-slate-400 text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={10} className="text-slate-600 shrink-0" />
                                        {log.timestamp}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold text-white text-[11px]">{log.actor_email || '—'}</td>
                                <td className="px-5 py-3.5">
                                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-black uppercase tracking-widest">
                                        {log.action || 'API_CALL'}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${METHOD_STYLE[log.method] || 'bg-slate-700 text-slate-400 border-white/5'}`}>
                                        {log.method}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5 font-mono text-slate-400 text-[10px] max-w-[280px] truncate" title={log.endpoint}>
                                    {log.endpoint}
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={`font-black text-xs ${log.statusCode >= 400 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {log.statusCode}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest">No audit logs found</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Users Tab ─────────────────────────────────────────────────────────────────

const RoleDropdown = ({ userId, currentRole, isApproved, onUpdated }) => {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSelect = async (newRole) => {
        setOpen(false);
        if (newRole === currentRole) return;
        setSaving(true);
        try {
            await apiClient.put(`/admin/users/${userId}`, { role: newRole, isApproved });
            onUpdated();
        } catch (err) {
            console.error('Role update failed', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-black uppercase tracking-widest transition-all ${ROLE_STYLE[currentRole] || ROLE_STYLE.guest} hover:opacity-80 disabled:opacity-50`}
            >
                {saving ? <div className="w-3 h-3 rounded-full border-t border-current animate-spin" /> : null}
                {currentRole}
                <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl min-w-[120px]">
                    {INTERNAL_WEB_ROLES.map(r => (
                        <button
                            key={r}
                            onClick={() => handleSelect(r)}
                            className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-slate-700 ${r === currentRole ? 'text-white' : 'text-slate-400'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ApprovalToggle = ({ userId, currentRole, isApproved, onUpdated }) => {
    const [saving, setSaving] = useState(false);

    const handleToggle = async () => {
        setSaving(true);
        try {
            await apiClient.put(`/admin/users/${userId}`, { role: currentRole, isApproved: !isApproved });
            onUpdated();
        } catch (err) {
            console.error('Approval update failed', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={saving}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50
                ${isApproved
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-slate-700 text-slate-400 border-white/5 hover:bg-slate-600'}`}
        >
            {saving
                ? <div className="w-3 h-3 rounded-full border-t border-current animate-spin" />
                : isApproved
                    ? <CheckCircle2 size={11} />
                    : <AlertCircle size={11} />}
            {isApproved ? 'Approved' : 'Pending'}
        </button>
    );
};

const UsersTab = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            setError(err.response?.status === 403
                ? 'Access Denied: Admin role required.'
                : 'Failed to fetch user list.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        </div>
    );

    if (error) return (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
        </div>
    );

    return (
        <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
            {/* Role legend */}
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">internalWebRole:</span>
                {INTERNAL_WEB_ROLES.map(r => (
                    <span key={r} className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${ROLE_STYLE[r]}`}>{r}</span>
                ))}
                <span className="text-[9px] text-slate-600 italic ml-auto">Controls INSIGHT dashboard access only — not Aruba cloud roles</span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[700px] text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-800/60 border-b border-white/5 sticky top-0 z-10">
                        <tr>
                            {['Email', 'internalWebRole', 'Approval', 'Registered', 'Actions'].map(h => (
                                <th key={h} className="px-5 py-4 font-black uppercase tracking-widest text-[9px] text-slate-400">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-slate-300">
                        {users.length > 0 ? users.map(user => (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-5 py-3.5">
                                    <span className="font-bold text-white text-[11px]">{user.email}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                    <RoleDropdown
                                        userId={user.id}
                                        currentRole={user.role}
                                        isApproved={user.isApproved}
                                        onUpdated={fetchUsers}
                                    />
                                </td>
                                <td className="px-5 py-3.5">
                                    <ApprovalToggle
                                        userId={user.id}
                                        currentRole={user.role}
                                        isApproved={user.isApproved}
                                        onUpdated={fetchUsers}
                                    />
                                </td>
                                <td className="px-5 py-3.5 font-mono text-slate-500 text-[10px]">
                                    {user.created_at
                                        ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : '—'}
                                </td>
                                <td className="px-5 py-3.5 text-slate-600 text-[10px] italic">
                                    Role change takes effect on next login
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-16 text-center">
                                    <Users size={36} className="mx-auto mb-3 text-slate-700" />
                                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest">No users registered yet</p>
                                    <p className="text-[10px] text-slate-700 mt-1">Users appear here automatically on first login</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Main Admin Page ───────────────────────────────────────────────────────────

const TABS = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'logs',  label: 'Audit Logs',      icon: Shield },
];

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="p-8 pb-32 min-h-screen bg-slate-950">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight italic uppercase">Admin</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage dashboard users and review audit activity</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-6 border-b border-white/5">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                                isActive
                                    ? 'border-blue-500 text-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'logs'  && <LogsTab />}
            </div>
        </div>
    );
};

export default AdminPage;
