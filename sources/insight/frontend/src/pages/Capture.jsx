import React from 'react';

function Capture() {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Traffic Capture & Logs</h1>
            <div className="bg-white shadow rounded-lg p-6">
                <p className="text-gray-600">
                    Raw API traffic logs from the Chrome Extension will be displayed here.
                </p>
                <div className="mt-4 border-t pt-4">
                    {/* Placeholder for log table */}
                    <div className="italic text-gray-400">No logs captured yet.</div>
                </div>
            </div>
        </div>
    );
}

export default Capture;
