import React from 'react';
import { Wifi, Plug } from 'lucide-react';
import { formatBytes } from '../../../api/apiClient';

const NetworkRow = ({ net }) => {
    const isWireless = net.displayType === 'wireless';
    const isActive = net.isEnabled === true;
    const health = isActive ? 'good' : 'none';
    const usageBytes = net.usageBytes || 0;
    const displayName = net.displayName;

    return (
        <tr className="hover:bg-white/[0.03] transition-all group">
            <td className="px-8 py-5 table-col-sticky border-r border-white/5 z-10 group-hover:bg-white/[0.03]">
                <div
                    className="text-white font-black tracking-tight text-base uppercase italic max-w-[200px] truncate"
                    title={displayName}
                >
                    {displayName}
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] shadow-current ${health === 'good' ? 'bg-emerald-500' : 'bg-slate-700 opacity-50'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${health === 'good' ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {health === 'good' ? 'Good' : 'Inactive'}
                    </span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {isActive ? 'Active' : 'Offline'}
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border border-white/5 ${isWireless ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {isWireless ? <Wifi size={16} /> : <Plug size={16} />}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">{isWireless ? 'Wireless' : 'Wired'}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-lg inline-block border border-white/5">
                    {net.type || 'Employee'}
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">{net.vlanInfo}</span>
                </div>
            </td>
            <td className="px-6 py-5 text-right w-32">
                {isWireless ? (
                    <div className="flex flex-col items-end">
                        <div className="text-white font-black text-xs tracking-tighter">
                            {formatBytes(usageBytes)}
                        </div>
                        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Downstream</div>
                    </div>
                ) : (
                    <span className="text-slate-700 font-black">-</span>
                )}
            </td>
            <td className="px-8 py-5 text-right w-28">
                <div className="inline-flex flex-col items-end px-4 py-1.5 bg-slate-800/80 rounded-2xl border border-white/5 group-hover:border-indigo-500/30 transition-all">
                    <div className="text-white font-black text-sm tracking-tighter">
                        {net.clientsCount || 0}
                    </div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Clients</div>
                </div>
            </td>
        </tr>
    );
};

export default NetworkRow;
