import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Bell, Users, Wifi, Monitor, Box, Copy } from 'lucide-react';
import UserWidget from './UserWidget';

const Sidebar = ({ onLogout }) => {
    const getNavLinkClass = ({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium transition-colors ${isActive
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-slate-800 hover:text-white"
        }`;

    return (
        <div className="flex flex-col w-64 bg-[#0F172A] border-r border-slate-800 h-full">
            <div className="flex items-center justify-center h-16 border-b border-slate-800 gap-3">
                <span className="text-xl font-black italic text-white tracking-widest uppercase">INSIGHT</span>
                <div className="relative flex items-center justify-center h-2 w-2" title="Live Sync">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto pt-4 space-y-1">
                <NavLink to="/overview" className={getNavLinkClass}><Home className="w-5 h-5 mr-3" /> Overview</NavLink>
                <NavLink to="/health" className={getNavLinkClass}><Activity className="w-5 h-5 mr-3" /> Health</NavLink>
                <NavLink to="/alerts" className={getNavLinkClass}><Bell className="w-5 h-5 mr-3" /> Alerts</NavLink>
                <NavLink to="/clients" className={getNavLinkClass}><Users className="w-5 h-5 mr-3" /> Clients</NavLink>
                <NavLink to="/networks" className={getNavLinkClass}><Wifi className="w-5 h-5 mr-3" /> Networks</NavLink>
                <NavLink to="/devices" className={getNavLinkClass}><Monitor className="w-5 h-5 mr-3" /> Devices</NavLink>
                <NavLink to="/applications" className={getNavLinkClass}><Box className="w-5 h-5 mr-3" /> Applications</NavLink>
                <NavLink to="/cloner" className={getNavLinkClass}><Copy className="w-5 h-5 mr-3" /> Cloner</NavLink>
            </nav>
            <UserWidget onLogout={onLogout} />
        </div>
    );
};

export default Sidebar;
