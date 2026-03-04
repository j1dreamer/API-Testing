import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Sliders, ArrowLeft } from 'lucide-react';
import UserWidget from './UserWidget';
import { useSite } from '../../context/SiteContext';

const SiteSidebar = ({ siteId, onLogout, userRole = 'guest' }) => {
    const navigate = useNavigate();
    const { sites } = useSite();

    const currentSite = sites.find(
        s => (s.siteId || s.id || s._id) === siteId
    );
    const siteName = currentSite
        ? (currentSite.siteName || currentSite.name || siteId)
        : siteId;

    const getNavLinkClass = ({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium transition-colors ${
            isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-slate-800 hover:text-white'
        }`;

    return (
        <div className="flex flex-col w-64 bg-[#0F172A] border-r border-slate-800 h-full">
            {/* Brand header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800 gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-black italic text-white tracking-widest uppercase">INSIGHT</span>
                    <div className="relative flex items-center justify-center h-2 w-2" title="Live Sync">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                </div>
            </div>

            {/* Back to All Sites */}
            <div className="px-3 pt-3 pb-1">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                >
                    <ArrowLeft size={14} />
                    All Sites
                </button>
            </div>

            {/* Site name label */}
            <div className="px-4 py-2 border-b border-slate-800/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Site</p>
                <p className="text-xs font-bold text-white truncate mt-0.5" title={siteName}>{siteName}</p>
            </div>

            {/* Site-scoped navigation */}
            <nav className="flex-1 overflow-y-auto pt-4 space-y-1">
                <NavLink
                    to={`/site/${siteId}`}
                    end
                    className={getNavLinkClass}
                >
                    <Home className="w-5 h-5 mr-3" />
                    Overview
                </NavLink>
                <NavLink
                    to={`/site/${siteId}/cloner`}
                    className={getNavLinkClass}
                >
                    <Sliders className="w-5 h-5 mr-3" />
                    Configuration
                </NavLink>
            </nav>

            <UserWidget onLogout={onLogout} />
        </div>
    );
};

export default SiteSidebar;
