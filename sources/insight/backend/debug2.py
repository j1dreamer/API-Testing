import asyncio
from app.core.cloner_service import fetch_site_config_live
import json

async def test():
    # Test grabbing config for the user's specific site id
    site_id = 'cdec793c-7988-4453-989a-c146e23282e8'
    config = await fetch_site_config_live(site_id)
    networks = config.get('networks', [])
    if isinstance(networks, dict):
        networks = networks.get('elements', [])
        
    print(f'Total networks found: {len(networks)}')
    for n in networks:
        print(f"ID: {n.get('id')} | Name: {n.get('networkName')} | Type: {n.get('type')}")
        
if __name__ == '__main__':
    asyncio.run(test())
