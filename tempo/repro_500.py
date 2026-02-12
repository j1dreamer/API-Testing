import asyncio
import json
from src.core.cloner_service import fetch_site_config_live, apply_config_to_site

async def test():
    site_id = "65248862-777b-463e-b8bc-b514e2903755"
    print(f"Testing site: {site_id}")
    
    try:
        config = await fetch_site_config_live(site_id)
        print("Config fetched successfully")
        if "error" in config:
            print(f"Error in config: {config['error']}")
            return

        ops = await apply_config_to_site("preview-only", config)
        print(f"Success! Generated {len(ops)} operations")
        for op in ops:
            print(f" - {op['type']}: {op['name']}")
            
    except Exception as e:
        import traceback
        print("\n!!! EXCEPTION CAUGHT !!!")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
