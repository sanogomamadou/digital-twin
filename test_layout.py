import os
import requests
from dotenv import load_dotenv

load_dotenv()

# First get a token
try:
    res = requests.post("http://localhost:8000/auth/login", json={"username": "testuser", "password": "password123"})
    token = res.json()["access_token"]
except Exception as e:
    # If testuser doesn't exist, register
    requests.post("http://localhost:8000/auth/register", json={"username": "testuser", "password": "password123"})
    res = requests.post("http://localhost:8000/auth/login", json={"username": "testuser", "password": "password123"})
    token = res.json()["access_token"]

# Now test layout prompt
payload = {
    "prompt": "Add a component",
    "currentState": {
        "id": "default",
        "name": "test",
        "domain": "factory",
        "gridCols": 10,
        "gridRows": 10,
        "components": [],
        "connections": []
    }
}
headers = {"Authorization": f"Bearer {token}"}
res = requests.post("http://localhost:8000/layout/prompt", json=payload, headers=headers)
print("Status:", res.status_code)
print("Response:", res.text)
