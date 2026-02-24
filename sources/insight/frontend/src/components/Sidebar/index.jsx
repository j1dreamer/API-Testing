import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Bell, Users, Wifi, Monitor, Box, Copy, LogOut } from 'lucide-react';

const Sidebar = ({ onLogout }) => {
    const getNavLinkClass = ({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium transition-colors ${isActive
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`;

    return (
        <div className="flex flex-col w-64 bg-gray-950 border-r border-gray-800 h-full">
            <div className="flex items-center justify-center h-16 border-b border-gray-800">
                <span className="text-xl font-bold text-white tracking-widest">AITC</span>
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
            <div className="p-4 border-t border-gray-800">
                <button
                    onClick={onLogout}
                    className="flex w-full items-center px-4 py-2 text-sm font-medium text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
