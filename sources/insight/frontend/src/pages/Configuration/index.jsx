import React, { useState } from 'react';
import { Copy, Wifi } from 'lucide-react';
import FullClone from './FullClone';
import SmartSync from './SmartSync';

const Configuration = () => {
    const [activeTab, setActiveTab] = useState('full_clone');

    return (
        <div className="w-full h-full flex flex-col pt-4">
            <div className="px-6 mb-4 flex space-x-4 border-b border-gray-200 dark:border-gray-800">
                <button
                    className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${activeTab === 'full_clone'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('full_clone')}
                >
                    <Copy size={18} />
                    Full Clone
                </button>
                <button
                    className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${activeTab === 'smart_sync'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('smart_sync')}
                >
                    <Wifi size={18} />
                    Smart Sync
                </button>
            </div>

            <div className="flex-1 w-full relative">
                {activeTab === 'full_clone' && <FullClone />}
                {activeTab === 'smart_sync' && <SmartSync />}
            </div>
        </div>
    );
};

export default Configuration;
