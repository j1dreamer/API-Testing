/**
 * Process wiredNetworks API response into a grouped hierarchy.
 *
 * Each entry = one wired network (VLAN) as the parent,
 * with its wirelessNetworks (SSIDs) embedded as children.
 *
 * Client count = wiredClientsCount + sum of wirelessClientsCount across all SSIDs.
 */

export const processWiredNetworks = (wiredData) => {
    const elements = wiredData?.elements || [];

    return elements.map(wired => {
        const ssids = wired.wirelessNetworks || [];

        // Sum wireless clients across all attached SSIDs
        const wirelessClientTotal = ssids.reduce(
            (sum, ssid) => sum + (ssid.wirelessClientsCount ?? 0),
            0
        );

        const totalClients = (wired.wiredClientsCount ?? 0) + wirelessClientTotal;

        return {
            id:           wired.id,
            name:         wired.wiredNetworkName || `VLAN ${wired.vlanId}`,
            vlanId:       wired.vlanId ?? '—',
            type:         wired.type || 'employee',
            isEnabled:    wired.isEnabled === true,
            health:       wired.health || 'unknown',
            wiredClients: wired.wiredClientsCount ?? 0,
            totalClients,
            ssids:        ssids.map(ssid => ({
                id:        ssid.id,
                name:      ssid.networkName,
                isEnabled: ssid.isEnabled === true,
                clients:   ssid.wirelessClientsCount ?? 0,
                band:      ssid.radioFrequencyBand || null,
                security:  ssid.security || null,
            })),
        };
    });
};
