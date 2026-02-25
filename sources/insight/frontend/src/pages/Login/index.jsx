import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { ShieldCheck } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Auto-check if already logged in by backend session
    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const res = await apiClient.get('/cloner/auth-session');
                if (res.data && res.data.token_value) {
                    sessionStorage.setItem('token', res.data.token_value);
                    onLoginSuccess();
                } else {
                    setCheckingAuth(false);
                }
            } catch (error) {
                setCheckingAuth(false);
            }
        };
        checkAuthStatus();
    }, [onLoginSuccess]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('/cloner/login', { username, password });
            sessionStorage.setItem('token', res.data?.token_value || 'aruba_session');
            sessionStorage.setItem('insight_user_email', username);

            // Add a small delay to ensure backend session is fully established 
            // and frontend state doesn't trigger requests too fast
            setTimeout(() => {
                onLoginSuccess();
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-[#020617] text-slate-200 overflow-hidden px-4">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-10 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black italic uppercase text-white tracking-tight">INSIGHT</h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Portal Access</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                            <input
                                type="text"
                                className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Password</label>
                            <input
                                type="password"
                                className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="pt-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 text-center mb-4">
                                Powered by INSIGHT
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-xl shadow-blue-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center border border-transparent hover:border-blue-400/50"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current mr-3"></div>
                                ) : null}
                                {loading ? 'Verifying...' : 'Sign in'}
                            </button>
                        </div>
                    </form>
                    {error && <p className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center leading-relaxed">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Login;
