import json

def search_keys(obj, target, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            current_path = f"{path}.{k}" if path else k
            if target.lower() in k.lower():
                print(f'Found Key: {current_path}')
            search_keys(v, target, current_path)
    elif isinstance(obj, list):
        if len(obj) > 0:
            search_keys(obj[0], target, f"{path}[0]")

try:
    with open('dashboard.json', 'r', encoding='utf-16') as f:
        data = json.load(f)
    print("--- Searching dashboard.json ---")
    search_keys(data, 'Byte')
    search_keys(data, 'Usage')
    search_keys(data, 'Port')
    search_keys(data, 'Traffic')
except Exception as e:
    print(f"Error: {e}")
