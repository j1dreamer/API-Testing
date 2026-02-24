import React from 'react';

const Overview = () => {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-white">Dashboard Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Mock for 6 dashboard cards */}
                {['Health', 'Alerts', 'Clients', 'Networks', 'Devices', 'Applications'].map(card => (
                    <div key={card} className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-200">{card} Summary</h2>
                        <div className="mt-4 text-3xl font-bold text-white">0</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Overview;
