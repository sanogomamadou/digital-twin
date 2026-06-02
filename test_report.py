import urllib.request
import json
import urllib.error

data = json.dumps({"twin_id": "default", "domain": "factory", "kpis": []}).encode('utf-8')
req = urllib.request.Request('http://localhost:8000/analytics/report', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
