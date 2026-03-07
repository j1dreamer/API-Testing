import React, { useState } from 'react';
import { Copy, Wifi, Layers, Users, Trash2 } from 'lucide-react';
import FullClone from './FullClone';
import SmartSync from './SmartSync';
import BatchProvision from './BatchProvision';
import BatchAccountAccess from './BatchAccountAccess';
import BatchDelete from './BatchDelete';
import ErrorBoundary from '../../components/ErrorBoundary';

const Configuration = () => {
    const [activeTab, setActiveTab] = useState('full_clone');

    // super_admin + tenant_admin see all tabs; manager/viewer only sees Full Clone + Smart Sync
    const userRole = sessionStorage.getItem('userRole') || 'viewer';
    const canSeeBatchTabs = userRole === 'super_admin' || userRole === 'tenant_admin';

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
                {canSeeBatchTabs && (
                    <button
                        className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${activeTab === 'batch_provision'
                            ? 'border-violet-500 text-violet-600 dark:text-violet-400 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        onClick={() => setActiveTab('batch_provision')}
                    >
                        <Layers size={18} />
                        Batch Provision
                    </button>
                )}
                {canSeeBatchTabs && (
                    <button
                        className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${activeTab === 'batch_access'
                            ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        onClick={() => setActiveTab('batch_access')}
                    >
                        <Users size={18} />
                        Batch Account Access
                    </button>
                )}
                {canSeeBatchTabs && (
                    <button
                        className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors ${activeTab === 'batch_delete'
                            ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        onClick={() => setActiveTab('batch_delete')}
                    >
                        <Trash2 size={18} />
                        Batch Delete
                    </button>
                )}
            </div>

            <div className="flex-1 w-full relative">
                <ErrorBoundary>
                    {activeTab === 'full_clone' && <FullClone />}
                    {activeTab === 'smart_sync' && <SmartSync />}
                    {canSeeBatchTabs && activeTab === 'batch_provision' && <BatchProvision />}
                    {canSeeBatchTabs && activeTab === 'batch_access' && <BatchAccountAccess />}
                    {canSeeBatchTabs && activeTab === 'batch_delete' && <BatchDelete />}
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default Configuration;
