from pymongo import MongoClient
import json
import re

def run():
    client_db = MongoClient('mongodb://localhost:27017/')
    db = client_db['aruba_capture']

    # Search for MAC address pattern
    cursor = db['raw_logs'].find({
        'response_body_text': {'$regex': '([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}'}
    }, {'response_body': 1, 'url': 1, 'path': 1}).limit(5)

    found = False
    for doc in cursor:
        print('--- LOG ---')
        print('URL:', doc.get('url'))
        data = doc.get('response_body')
        if not data: continue
        
        found = True
        if isinstance(data, list) and len(data) > 0:
            print('Full Sample (List Item):', json.dumps(data[0], indent=2))
        elif isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                    print(f'Full List in key "{k}":', json.dumps(v[0], indent=2))
                    break
            else:
                print('Full Sample (Dict):', json.dumps(data, indent=2))
        print('\n')

    if not found:
        print('No logs with MAC patterns found')

if __name__ == '__main__':
    run()
