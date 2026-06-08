import urllib.request
import urllib.error
import json

base = "https://digital-twin-api-1zo1.onrender.com"

# Register a fake user (might already exist, if so ignore error)
try:
    req = urllib.request.Request(base + "/auth/register", data=json.dumps({"username": "test_share_user", "password": "password"}).encode(), headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req, timeout=10)
except:
    pass

# Login
req = urllib.request.Request(base + "/auth/login", data=json.dumps({"username": "test_share_user", "password": "password"}).encode(), headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read().decode())["access_token"]

# Share
url = base + "/share"
data = json.dumps({"twin_id": "default", "name": "test share", "password": "pass"}).encode()
req = urllib.request.Request(url, data=data, headers={
    'Origin': 'https://digital-twin-six-black.vercel.app',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
})

try:
    resp = urllib.request.urlopen(req, timeout=10)
    print('STATUS:', resp.status)
    print('BODY:', resp.read().decode())
except urllib.error.HTTPError as e:
    print('STATUS:', e.code)
    print('BODY:', e.read().decode())
