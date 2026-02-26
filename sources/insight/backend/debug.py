import asyncio
import httpx

async def test():
    payload = {
        'network_name': 'TestSSID20',
        'network_type': 'EMPLOYEE',
        'security': 'WPA2_PSK',
        'password': 'password123',
        'is_hidden': False,
        'is_wifi6_enabled': True,
        'band_24': True,
        'band_5': True,
        'band_6': False,
        'client_isolation': False,
        'vlan_id': None,
        'target_site_ids': ['cdec793c-7988-4453-989a-c146e23282e8']
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post('http://localhost:8001/api/cloner/sync-create', json=payload, timeout=30.0)
        import json
        with open('out.json', 'w') as f:
            f.write(json.dumps(res.json(), indent=2))

if __name__ == '__main__':
    asyncio.run(test())
