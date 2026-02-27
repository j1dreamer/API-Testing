/**
 * Helper to process and flatten network data from multiple API endpoints
 */

const isUUID = (str) => {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const processHierarchicalNetworks = (wiredData, summaryData) => {
    const wiredElements = wiredData?.elements || [];
    const summaryElements = summaryData?.elements || summaryData?.networks || [];

    // 1. Create a lookup map for summary data (traffic, SSID names etc)
    const summaryMap = new Map();
    summaryElements.forEach(item => {
        const id = item.networkId || item.id;
        if (id) summaryMap.set(id, item);
    });

    const result = [];

    wiredElements.forEach(wired => {
        const vlanId = wired.vlanId || 'Native';
        const wiredName = wired.wiredNetworkName;

        // Final suppressed name for Wired
        const resolvedWiredName = (wiredName && !isUUID(wiredName))
            ? wiredName
            : `VLAN ${vlanId}`;

        const vlanInfo = `(VLAN ${vlanId}) ${resolvedWiredName}`;

        // 2. Add the Wired Network itself
        result.push({
            id: wired.id,
            networkId: wired.id,
            displayName: resolvedWiredName,
            type: wired.type || 'employee',
            displayType: 'wired',
            vlanId: wired.vlanId,
            vlanInfo: vlanInfo,
            clientsCount: wired.wiredClientsCount || 0,
            usageBytes: 0, // Wired networks don't usually have aggregate usage in this endpoint
            isEnabled: wired.isEnabled,
            source: wired
        });

        // 3. Process child Wireless Networks (SSIDs)
        const childWireless = wired.wirelessNetworks || [];
        childWireless.forEach(ssid => {
            const ssidId = ssid.id;
            const ssidSummary = summaryMap.get(ssidId) || {};

            const ssidName = ssid.networkName;
            const resolvedSsidName = (ssidName && !isUUID(ssidName))
                ? ssidName
                : `VLAN ${vlanId}`;

            result.push({
                id: ssidId,
                networkId: ssidId,
                displayName: resolvedSsidName,
                type: ssidSummary.type || 'guest',
                displayType: 'wireless',
                vlanId: wired.vlanId, // Map from parent
                vlanInfo: vlanInfo,  // Map from parent
                clientsCount: ssidSummary.wirelessClientsCount || 0,
                usageBytes: ssidSummary.dataTraffic?.downstreamDataTransferredInBytes ||
                    ssidSummary.downstreamDataTransferredInBytes || 0,
                isEnabled: ssid.isEnabled,
                source: { ...ssid, ...ssidSummary }
            });
        });
    });

    return result;
};
