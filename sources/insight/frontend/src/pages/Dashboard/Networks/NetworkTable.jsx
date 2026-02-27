import React from 'react';
import { ArrowDown, ArrowUp, Activity } from 'lucide-react';
import NetworkRow from './NetworkRow';

const NetworkTable = ({ data, sortConfig, onSort, loading }) => {
    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ArrowDown size={12} className="opacity-20 ml-1 inline" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={12} className="text-indigo-500 ml-1 inline" /> :
            <ArrowDown size={12} className="text-indigo-500 ml-1 inline" />;
    };

    return (
        <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden w-full">
            <div className="max-h-[calc(100vh-250px)] overflow-auto custom-scrollbar">
                <table className="w-full min-w-[1100px] text-left text-sm whitespace-nowrap block md:table">
                    <thead className="text-slate-500 border-b border-white/5 table-header-sticky">
                        <tr>
                            <th onClick={() => onSort('name')} className="px-8 py-6 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group table-col-sticky table-header-sticky resizable-col min-w-[220px]">
                                Network <SortIcon column="name" />
                            </th>
                            <th className="px-6 py-6 font-black uppercase tracking-widest text-[10px] resizable-col min-w-[100px]">Health</th>
                            <th className="px-6 py-6 font-black uppercase tracking-widest text-[10px] resizable-col min-w-[100px]">State</th>
                            <th onClick={() => onSort('type')} className="px-6 py-6 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white transition-colors group resizable-col min-w-[140px]">
                                Type <SortIcon column="type" />
                            </th>
                            <th className="px-6 py-6 font-black uppercase tracking-widest text-[10px] resizable-col min-w-[140px]">Usage</th>
                            <th onClick={() => onSort('vlan')} className="px-6 py-6 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white group resizable-col min-w-[140px]">
                                (VLAN) Wired Network <SortIcon column="vlan" />
                            </th>
                            <th onClick={() => onSort('usage')} className="px-6 py-6 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white group text-right w-32 resizable-col">
                                24h Usage <SortIcon column="usage" />
                            </th>
                            <th onClick={() => onSort('clients')} className="px-8 py-6 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:text-white group text-right w-28 resizable-col">
                                Clients <SortIcon column="clients" />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                        {data.map((net) => (
                            <NetworkRow key={`${net.displayType}-${net.networkId}`} net={net} />
                        ))}

                        {!loading && data.length === 0 && (
                            <tr>
                                <td colSpan="8" className="px-6 py-24 text-center text-slate-500 bg-black/5">
                                    <div className="flex flex-col items-center">
                                        <div className="p-6 bg-slate-800 rounded-3xl mb-6 opacity-20">
                                            <Activity size={64} className="text-slate-400" />
                                        </div>
                                        <p className="text-xl font-black text-slate-700 uppercase tracking-[0.2em]">No networks found</p>
                                        <p className="text-xs text-slate-600 mt-3 font-bold uppercase tracking-widest">Verify site infrastructure sync</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default NetworkTable;
